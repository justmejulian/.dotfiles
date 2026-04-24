# Hammerspoon Config

Modular window/space/app management. Uses [Hyperkey](https://hyperkey.app/) (`cmd+alt+ctrl`) as primary modifier.

## Modules

### screen_layouts
Watches for monitor connect/disconnect and applies matching window layout automatically.

Define layouts in `init.lua` — each layout has a `match` function (receives all screens, returns bool) and an `apply` function:

```lua
screenLayouts.addLayout {
  name = 'my_layout',
  match = function(screens) return #screens == 2 end,
  apply = function(_screens)
    local ext = screenLayouts.externalScreen()
    -- position windows...
  end,
}

screenLayouts.start()
```

**Helpers:**
- `screenLayouts.externalScreen()` — first non-primary screen
- `screenLayouts.screenByName(name)` — screen by exact name

**Find screen names:**
```sh
hs -c 'hs.inspect(hs.fnutils.map(hs.screen.allScreens(), function(s) return s:name() end))'
```

**Manual trigger:**
```sh
hs -c "require('modules.screen_layouts').apply()"
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
