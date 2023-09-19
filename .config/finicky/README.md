# finicky
create a config using:  Finicky Kickstart
https://finicky-kickstart.now.sh/

name config.js an place in .config/finicky folder

create simlink
```
ln -s ~/.config/finicky/config.js ~/.finicky.js
```

## Open all files from slack in Chrome

```
    {
      // Open any link clicked in Slack in Google Chrome
      match: ({ opener }) =>
        opener.bundleId === "com.tinyspeck.slackmacgap",
      browser: "Google Chrome"
    },
```
