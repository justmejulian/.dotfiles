-- Ask what I was doing after ActivityWatch detects an AFK period.
--   "I was here"  → rewrite the AFK event as not-afk, so the focused app counts
--   "Save" + text → keep it as AFK and log the text to an away-notes bucket
--   "Save" empty  → keep it as AFK
local M = {}

M.api = 'http://127.0.0.1:5600/api/0'
M.minAway = 5 * 60 -- only ask about AFK periods at least this long (seconds)
M.maxAge = 15 * 60 -- ignore AFK periods that ended longer ago than this
M.pollInterval = 10

M._timer = nil
M._host = nil
M._prompting = false

local json = { ['Content-Type'] = 'application/json' }
local settingsKey = 'aw_away.lastAskedId'

local function afkBucket()
  return 'aw-watcher-afk_' .. M._host
end

local function notesBucket()
  return 'aw-watcher-away-notes_' .. M._host
end

-- AW timestamps look like 2026-10-12T11:28:46.189000+00:00 (always UTC)
local function parseUtc(ts)
  local y, mo, d, h, mi, s = ts:match '(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)'
  local fields = { year = y, month = mo, day = d, hour = h, min = mi, sec = s, isdst = false }
  local now = os.time()
  local offset = os.difftime(now, os.time(os.date('!*t', now)))
  return os.time(fields) + offset
end

local function logError(what, status, body)
  print(string.format('aw_away: %s failed (%s): %s', what, tostring(status), tostring(body)))
end

local function markHere(bucket, event)
  local url = string.format('%s/buckets/%s/events/%d', M.api, bucket, event.id)
  hs.http.doAsyncRequest(url, 'DELETE', nil, json, function(status, body)
    if status ~= 200 then
      return logError('delete afk event', status, body)
    end
    local replacement = hs.json.encode {
      { timestamp = event.timestamp, duration = event.duration, data = { status = 'not-afk' } },
    }
    hs.http.asyncPost(M.api .. '/buckets/' .. bucket .. '/events', replacement, json, function(st, b)
      if st ~= 200 then logError('insert not-afk event', st, b) end
    end)
  end)
end

local function saveNote(event, text)
  local bucket = notesBucket()
  local meta = hs.json.encode { client = 'hammerspoon-aw-away', type = 'away-note', hostname = M._host }
  hs.http.asyncPost(M.api .. '/buckets/' .. bucket, meta, json, function()
    local note = hs.json.encode {
      { timestamp = event.timestamp, duration = event.duration, data = { label = text } },
    }
    hs.http.asyncPost(M.api .. '/buckets/' .. bucket .. '/events', note, json, function(st, b)
      if st ~= 200 then logError('insert away note', st, b) end
    end)
  end)
end

local function ask(bucket, event)
  M._prompting = true
  hs.settings.set(settingsKey, event.id)
  local start = parseUtc(event.timestamp)
  local message = string.format(
    'Away for %d min (%s–%s)',
    math.floor(event.duration / 60 + 0.5),
    os.date('%H:%M', start),
    os.date('%H:%M', start + math.floor(event.duration))
  )
  hs.focus()
  local button, text = hs.dialog.textPrompt(
    message,
    'What were you doing? Leave empty to keep it as away.',
    '',
    'Save',
    'I was here'
  )
  M._prompting = false
  if button == 'I was here' then
    markHere(bucket, event)
  elseif text and text:match '%S' then
    saveNote(event, text)
  end
end

local function poll()
  if M._prompting or not M._host then return end
  local bucket = afkBucket()
  hs.http.asyncGet(M.api .. '/buckets/' .. bucket .. '/events?limit=5', nil, function(status, body)
    if status ~= 200 then return end
    local events = hs.json.decode(body) or {}
    local lastAsked = hs.settings.get(settingsKey) or 0
    -- events are newest first; skip index 1 so the watcher is done extending it
    for i = 2, #events do
      local e = events[i]
      if e.data.status == 'afk' then
        local ended = parseUtc(e.timestamp) + e.duration
        if e.id > lastAsked and e.duration >= M.minAway and os.time() - ended <= M.maxAge then
          -- leave the HTTP callback before showing the blocking dialog
          hs.timer.doAfter(0, function() ask(bucket, e) end)
        end
        return
      end
    end
  end)
end

function M.start()
  hs.http.asyncGet(M.api .. '/info', nil, function(status, body)
    if status == 200 then
      M._host = hs.json.decode(body).hostname
    else
      logError('fetch info', status, body)
    end
  end)
  M._timer = hs.timer.doEvery(M.pollInterval, poll)
end

function M.stop()
  if M._timer then
    M._timer:stop()
    M._timer = nil
  end
end

return M
