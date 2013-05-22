GoxTradingBot (Tobli version)
=============================

Gox Trading Bot Chrome Extension

This project is modified/enhanced version of the original Gox Trading Bot (https://chrome.google.com/webstore/detail/gox-trading-bot/iejmifigokhpcgpmoacllcdiceicmejb)



Disclaimer
----------
The authors of this project is NOT responsible for any damage or loss caused by this software.
There can be bugs, and the bot may not perform as expected or specified.
The author has tested it and is using it himself, but there are NO warranties whatsoever!
Please consider testing it first with a small amount of funds, and check to the code to see what how it's working.



Enhanced features of this modified bot
--------------------------------------

 * Change sample intervals for the EMA calculations (1 min, 5 min, 10 min, 15 min, 30 min, 45 min, 1 hour, 2 hours, 3 hours)
 
 * Decide when to trade after trend switch (1-5 samples above/below thresholds, separate settings for buy/sell)
 
 * Separate buy and sell thresholds
 
 * Trade in fiat currencies other than USD
 
 * Keep an amount of BTC away from trading
 
 * Detect and eliminate peaks/invalid samples from MtGox

 * Possibility to disable actual trading (the bot does everything, except the actual trading). Good for testing if e.g. a changed sample interval will cause a trend switch and would trigger an immediate trade.
 
 * Show chart with price and EMA-values

 * Caching trade data to avoid hammering of MtGox and faster loading
 
 * Option to always start the bot in "disabled" mode to avoid instant accidental trading with "bad" settings from last run.
 
 * Using MtGox API v2 for more reliable access


	
Installation
------------

1. Copy all files from github to your computer.
2. Start Chrome and go to Options/Tools/Extensions (or just type URL: "chrome://extensions/")
3. Click on "Load unpacked extension..." and select the folder that holds the files 
4. The "Gox Trading Bot (Tobli)" should have been added
5. Click "Options" to configure the bot

From the extensions page in Chrome, you can also open the console to se some logging I you want:
Click the link after Inspect views: "_generated_background_page.html" next to the extension, and pick the Console-tab



Changelog
=========

0.2.2.0
- Indicator arrows in graph
- Thinner price line
- Zoomable chart
- Added link to external charts (at bitcoincharts.com)
- Experimental section added
- Experimental feature: Only trade after trend switch (if starting the bot between trend switches, wait until next swicth)
- Experimental feature: "The Crazy Ivan" - reverse the EMA-logic: The bot will sell when it's supposed to buy, and buy when it's supposed to sell!
- Lowered retry-rate when failed to fetch user info (retry after 1 minute instead of 10 seconds) to avoid hammering MtGox
- More robust handling of network problems (updates could stop after a network loss) - bot should now update and resume within a minute
- Better handling when computer resumes from sleep (updates could stop after sleep) - bot should now update and resume within a minute

0.2.1.8
- Fixed stupid bug, not fetching last sample properly ("Update not finished - do not trade!" in the console log)

0.2.1.7
- Fixed problem with garbage in cache after switching currency (the cache will now be flushed when changing currency)
- Fixed problem fetching trade data with very short intervals and currecies with very low trading volumes (it's still a problem to get accurate EMA-values, but it's not quite possible when hardly any trades are being made!)
- Selecting currency in settings is now made from a drop-down list
- New icon: green eyes = trading is enabled :)

0.2.1.6
- Switched to MtGox API v2 by default (seems more stable when MtGox is DDoS:ed or having oher problems)
- Fixed positon icons for chart and settings in popup
- Improved speed/effectiveness when fetching data from MtGox (use or cache all usable data in every chunk)

0.2.1.5
- Fixed bug corrupting data when user updated settings while fetching data
- Cache trade data in local storage (a lot faster loading and less hammering of MtGox servers on restart)
- Remember if chart is visible or not when closing popup
- New setting "Disabled on start". Will make he bot always start disabled to avoid instant/accidental trading on startup
- Lowered minimum sample interval to 1 minute for those who would like to experiment
- Separate "Buy/Sell after X samples above/below thresholds"
- Allow buy/sell after up to 5 samples (could be useful with very short sample intervals)

0.2.1.4
- Fixed fetching trades with no API key. The bot can now be used to monitor trend without an API Key (but it will not be able to trade of course)
- Experimental implementation of MtGox API v2 (set "useAPIv2=true" in file "background.js" if you want to test. But be warned: It's not extensively tested, so use at your own risk!)

0.2.1.3
- Added cache-busting for calls fetching trades

0.2.1.2
- Fixed typos
- Better trend indicator i tooltip on chart

0.2.1.1
- Added chart

0.2.1.0
- Initial release


Donations
---------
This code is absolutely free to use.
But if you like it, feel free to make a small donation :)
1LUqdAXvH9gbYemZKeiMrVJ5njhm6ZvKmF
