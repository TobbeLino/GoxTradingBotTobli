GoxTradingBot (Tobli version)
=============================

Gox Trading Bot Chrome Extension

This project is modified/enhanced version of the original Gox Trading Bot (https://chrome.google.com/webstore/detail/gox-trading-bot/iejmifigokhpcgpmoacllcdiceicmejb)



Disclaimer
----------
The authors of this project is NOT responible for any damage or loss caused by this software.
There can be bugs, and the bot may not perform as expected or specified.
The author has tested it and is using it himself, but there are NO warranties whatsoever!
Please consider testing it first with a small amount of funds, and check to the code to see what how it's working.



Enhanced features of this modified bot
--------------------------------------

 * Change sample intervals for the EMA calculations (5 min, 10 min, 15 min, 30 min, 1 hour, 2 hours, 3 hours)
 
 * Decide when to trade after trend switch (1, 2 or 3 samples above thresholds)
 
 * Separate buy and sell thresholds
 
 * Trade in fiat currencies other than USD
 
 * Keep an amount of BTC away from trading
 
 * Detect and eliminate peaks/invalid samples from MtGox

 * Possibility to disable actual trading (the bot does everything, except the actual trading). Good for testing if e.g. a changed sample interval will cause a trend switch and would trigger an immediate trade.
 
 * Show chart with price and EMA-values


	
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