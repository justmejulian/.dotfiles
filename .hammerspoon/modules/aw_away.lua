-- Ask what I was doing after ActivityWatch detects an AFK period.
--   "I was here"  → rewrite the AFK event as not-afk, so the focused app counts
--   "Save" + text → keep it as AFK and add the text as the reason on the AFK event
--   "Save" empty  → keep it as AFK
local M = {}

M.api = 'http://127.0.0.1:5600/api/0'
M.minAway = 5 * 60 -- only ask about AFK periods at least this long (seconds)
M.maxAge = 15 * 60 -- ignore AFK periods that ended longer ago than this
M.pollInterval = 10

M._timer = nil
M._host = nil
M._prompting = false
M._askTimer = nil

local json = { ['Content-Type'] = 'application/json' }
local settingsKey = 'aw_away.lastAskedId'

local function afkBucket()
  return 'aw-watcher-afk_' .. M._host
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

-- Replace the AFK event in place (same id) with new data
local function rewrite(bucket, event, data)
  local replacement = hs.json.encode {
    { id = event.id, timestamp = event.timestamp, duration = event.duration, data = data },
  }
  hs.http.asyncPost(M.api .. '/buckets/' .. bucket .. '/events', replacement, json, function(status, body)
    if status ~= 200 then logError('rewrite afk event ' .. event.id, status, body) end
  end)
end

local function ask(bucket, event)
  print(string.format('aw_away: asking about afk event %d (%ds)', event.id, math.floor(event.duration)))
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
    rewrite(bucket, event, { status = 'not-afk' })
  elseif text and text:match '%S' then
    rewrite(bucket, event, { status = 'afk', reason = text })
  end
end

-- retried from poll, so a server that is down at startup is picked up later
local function fetchHost()
  hs.http.asyncGet(M.api .. '/info', nil, function(status, body)
    if status == 200 then
      M._host = hs.json.decode(body).hostname
    else
      logError('fetch info', status, body)
    end
  end)
end

local function poll()
  if M._prompting then return end
  if not M._host then return fetchHost() end
  local bucket = afkBucket()
  hs.http.asyncGet(M.api .. '/buckets/' .. bucket .. '/events?limit=5', nil, function(status, body)
    if status ~= 200 then return logError('fetch afk events', status, body) end
    local events = hs.json.decode(body) or {}
    local lastAsked = hs.settings.get(settingsKey) or 0
    -- events are newest first; skip index 1 so the watcher is done extending it
    for i = 2, #events do
      local e = events[i]
      if e.data.status == 'afk' then
        local ended = parseUtc(e.timestamp) + e.duration
        if e.id > lastAsked and e.duration >= M.minAway and os.time() - ended <= M.maxAge then
          -- leave the HTTP callback before showing the blocking dialog; keep a
          -- reference so the timer is not garbage collected before it fires
          M._askTimer = hs.timer.doAfter(0, function() ask(bucket, e) end)
        end
        return
      end
    end
  end)
end

function M.start()
  fetchHost()
  M._timer = hs.timer.doEvery(M.pollInterval, poll)
end

function M.stop()
  if M._timer then
    M._timer:stop()
    M._timer = nil
  end
end

return M
