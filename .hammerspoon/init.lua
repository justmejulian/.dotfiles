hs.autoLaunch(true)
hs.consoleOnTop(false)
hs.dockIcon(false)
hs.menuIcon(true)

hyper = { "cmd", "alt", "ctrl" } -- Hyper key

apps = {
  {
    name = 'Slack',
    summonKey = 'm',
  },
  {
    name = 'Obsidian',
    summonKey = 'o',
  },
  {
    name = 'Kitty',
    summonKey = 'k',
  },
  {
    name = 'Google Chrome',
    summonKey = 'i',
  },
}

hs.fnutils.each(apps, function(app)
  hs.hotkey.bind(hyper, app.summonKey, function()
    hs.application.launchOrFocus(app.name)
  end)
end)
