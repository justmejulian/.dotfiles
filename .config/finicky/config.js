// Generated by Finicky Kickstart 
// Save as ~/.finicky.js

module.exports = {
  defaultBrowser: "Safari",      
  handlers: [
    {
      match: /^https?:\/\/energych\.atlassian\.net\/.*$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/energych\.atlassian\.net\/.*$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/tools\.energy$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/energyschweizag\..*$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/.*\.figma\.com$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/github\.com\/energych$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/.*energy\.ch$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/.*infomaniak\.com$/,
      browser: "Google Chrome"
    },
    {
      match: /^https:\/\/dev\.azure\.com\/energyschweiz\/$/,
      browser: "Google Chrome"
    },
    {
      match: /^https?:\/\/.*office\.com$/,
      browser: "Google Chrome"
    },
    {
      // Open any link clicked in Slack in Google Chrome
      match: ({ opener }) =>
        opener.bundleId === "com.tinyspeck.slackmacgap",
      browser: "Google Chrome"
    },
  ],
  options: {
    logRequests: false
  },
}
