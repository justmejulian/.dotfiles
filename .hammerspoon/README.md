# Hammerspoon Config

Modular window/space/app management. Uses [Hyperkey](https://hyperkey.app/) (`cmd+alt+ctrl`) as primary modifier.

## Modules

### layouts
Named layout registry. Register layouts in `init.lua`, call them manually or from screen change callbacks.

```lua
layouts.register('my_layout', function(_screens)
  local ext = layouts.externalScreen()
  -- position windows...
end)
```

**Helpers:**
- `layouts.externalScreen()` — first non-primary screen
- `layouts.screenByName(name)` — screen by exact name

**Find screen names:**
```sh
hs -c 'hs.inspect(hs.fnutils.map(hs.screen.allScreens(), function(s) return s:name() end))'
```

**Call a layout from CLI:**
```sh
hs -c "require('modules.layouts').apply('my_layout')"
```

**Call layouts with fzf:**
```sh
hs -c "hs.inspect(require('modules.layouts').list())" \
  | tr -d '{"} ' | tr ',' '\n' \
  | fzf --prompt='layout> ' \
  | xargs -I{} hs -c "require('modules.layouts').apply('{}')"
```

Or as a shell function in your `.zshrc`:
```sh
hs-layout() {
  hs -c "hs.inspect(require('modules.layouts').list())" \
    | tr -d '{"} ' | tr ',' '\n' \
    | fzf --prompt='layout> ' \
    | xargs -I{} hs -c "require('modules.layouts').apply('{}')"
}
```

---

### screen_watcher
Generic screen change observer. Fires registered callbacks on monitor connect/disconnect (1s debounce).

```lua
screenWatcher.onChange(function(screens)
  -- screens = hs.screen.allScreens()
  if #screens == 1 then
    layouts.apply('maximize_all')
  end
end)

screenWatcher.start()
```

---

### windows
Window sizing and movement. All functions accept an optional `win` param — defaults to focused window.

| Shortcut | Action |
|---|---|
| `cmd+alt+return` | Maximize |
| `cmd+alt+left` | Snap left half |
| `cmd+alt+right` | Snap right half |
| `cmd+alt+1/2/3` | Snap to third |
| `cmd+alt+m` | Move to next screen |
| `hyper+h` | Focus window west |
| `hyper+l` | Focus window east |

---

### spaces
Move focused window between Mission Control spaces.

| Shortcut | Action |
|---|---|
| `cmd+alt+n` | Move window to next space |
| `cmd+alt+shift+n` | Move window to prev space |

Creates new space if moving beyond the last one.

---

### summon
`hyper+<key>` → launch app if not running, focus if running, cycle windows if already focused. Configure in `init.lua`:

```lua
local apps = {
  k = 'Ghostty',
  f = 'Finder',
  -- ...
}
```

---

## Misc

**Reload config:** `hyper+r`

**CLI access** (via `hs` command after install):
```sh
hs -c "hs.alert.show('hello')"
```
