# macOS `defaults`

Set preferences, the macOS user defaults system works with both the OS and with individual applications.

Find a list of macOS `defaults` [here](https://macos-defaults.com).

## set default

I have a list of my default settings in a bash script.

```
bash set_defaults.sh

```

## modifier keys

```
@ is command
^ is control
~ is option
$ is shift
```

## set keyboard shortcuts

[This article explains how](https://ryanmo.co/2017/01/05/setting-keyboard-shortcuts-from-terminal-in-macos/)

### global

```
defaults write -globalDomain NSUserKeyEquivalents  -dict-add "Save as PDF\\U2026" "@\$p";
```

### one app

```
defaults write com.omnigroup.OmniFocus2 NSUserKeyEquivalents -dict-add "Show Next Tab" "^\\U005D"
```

## read current defaults

```
defaults read
```
