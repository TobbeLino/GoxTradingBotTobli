var bp = chrome.extension.getBackgroundPage();
var sla = document.getElementById("sla");
var tradInt = document.getElementById("tradingIntervalMinutes");
var tc_buy = document.getElementById("tickCountBuy");
var tc_sell = document.getElementById("tickCountSell");
var currencySelector = document.getElementById("currency");

function rese() {
	document.getElementById("emas").value=10;
	document.getElementById("emal").value=21;
	//document.getElementById("tras").value=0.25;
	document.getElementById("buy_tras").value=0.25;
	document.getElementById("sell_tras").value=0.25;
	
	document.getElementById("currency").value="USD";
	document.getElementById("keepBTC").value=0.0;
	
	document.getElementById("tradingEnabled").checked = true;
	document.getElementById("tradingDisabledOnStart").checked = false;
	
//	document.getElementById("keepFiat").value=0.0;
	
	for (var i=0; i<tradInt.length; i++) {
    if (tradInt[i].value == 60) {
    	tradInt.selectedIndex=i;
    	break;
    }
  }

	//sla.selectedIndex=1
	for (var i=0; i<sla.length; i++) {
    if (sla[i].value == 72) {
    	sla.selectedIndex=i;
    	break;
    }
  }

	for (var i=0; i<tc_buy.length; i++) {
    if (tc_buy[i].value == 1) {
    	tc_buy.selectedIndex=i;
    	break;
    }
  }
	for (var i=0; i<tc_sell.length; i++) {
    if (tc_sell[i].value == 1) {
    	tc_sell.selectedIndex=i;
    	break;
    }
  }
	for (var i=0; i<currencySelector.length; i++) {
    if (currencySelector[i].value == "USD") {
    	currencySelector.selectedIndex=i;
    	break;
    }
  }
}

function save() {
	//var tr = parseFloat(document.getElementById("tras").value);
	var buy_tr = parseFloat(document.getElementById("buy_tras").value);
	if (isNaN(buy_tr) || buy_tr<0 || buy_tr>10) {
		alert("Invalid \"buy treshold\"");
		return;
	}

	var sell_tr = parseFloat(document.getElementById("sell_tras").value);
	if (isNaN(sell_tr) || sell_tr<0 || sell_tr>10) {
		alert("Invalid \"sell treshold\"");
		return;
	}

	var es = parseInt(document.getElementById("emas").value);
	var el = parseInt(document.getElementById("emal").value);
	if (isNaN(es) || isNaN(el)) {
		alert("Invalid \"EMA\"");
		return;
	}

	if (es==el) {
		alert("The EMA parameters must be different");
		return;
	}

	if (es<1 || el<1) {
		alert("EMA parameter must be bigger than 1");
		return;
	}

	if (es>bp.MaxSamplesToKeep || el>bp.MaxSamplesToKeep) {
		alert("EMA parameter too big - max is "+bp.MaxSamplesToKeep);
		return;
	}

	if (es > el) {
		var tmp = es;
		es = el;
		el = tmp;
		document.getElementById("emas").value=es;
		document.getElementById("emal").value=el;
	}

	var keepBTC=parseFloat(document.getElementById("keepBTC").value);
//	var keepFiat=parseFloat(document.getElementById("keepFiat").value);
	if (isNaN(keepBTC) || keepBTC<0) {
		alert("Invalid \"Keep BTC\"");
		return;
	}
//	if (isNaN(keepFiat) || keepFiat<0) {
//		alert("Invalid \"Keep Fiat\"");
//		return;
//	}
	
	if (bp.EmaShortPar!=es || bp.EmaLongPar!=el || bp.MinBuyThreshold!=buy_tr || bp.MinSellThreshold!=sell_tr || bp.tradingIntervalMinutes != parseInt(tradInt.value) ) {
		if (!confirm("Applying different Trading interval/EMA/Threshold values may case an instant trigger to execute a trade."))  return;
	}

	localStorage.ApiKey=bp.ApiKey=document.getElementById("apikey").value;
	localStorage.ApiSec=bp.ApiSec=document.getElementById("apisec").value;
	bp.schedUpdateInfo(10);

	localStorage.tradingEnabled=bp.tradingEnabled=(document.getElementById("tradingEnabled").checked?1:0);
	if (bp.tradingEnabled) {
		chrome.browserAction.setIcon({path: 'robot_trading_on.png'});
	} else {
		chrome.browserAction.setIcon({path: 'robot_trading_off.png'});
	}
	localStorage.tradingDisabledOnStart=bp.tradingDisabledOnStart=(document.getElementById("tradingDisabledOnStart").checked?1:0);
	
//	console.log("localStorage.tradingEnabled="+localStorage.tradingEnabled);

	var resetH1=false;
	
	var currency=currencySelector.value;
	if (currency!=bp.currency) {
		bp.emptySampleCache();
		resetH1=true;
	}
	localStorage.currency=bp.currency=currency;
	localStorage.keepBTC=bp.keepBTC=keepBTC;
//	localStorage.keepFiat=bp.keepFiat=keepFiat;

	if (bp.tradingIntervalMinutes != parseInt(tradInt.value)) {
		resetH1=true;
	}

	try {
		localStorage.tradingIntervalMinutes=bp.tradingIntervalMinutes=parseInt(tradInt.value);
		//localStorage.MaxMinutesBack=bp.MaxMinutesBack=parseInt(bp.MaxSamplesToKeep*bp.tradingIntervalMinutes);
	
		//localStorage.LogLines=bp.LogLines=parseInt(sla.value)
		localStorage.LogLines=bp.LogLines=parseInt(sla.value*60/localStorage.tradingIntervalMinutes);
	
		localStorage.tickCountBuy=bp.tickCountBuy=parseInt(tc_buy.value);
		localStorage.tickCountSell=bp.tickCountSell=parseInt(tc_sell.value);
	
		localStorage.EmaShortPar=bp.EmaShortPar=es;
		localStorage.EmaLongPar=bp.EmaLongPar=el;
		//localStorage.MinThreshold=bp.MinThreshold=tr;
		localStorage.MinBuyThreshold=bp.MinBuyThreshold=buy_tr;
		localStorage.MinSellThreshold=bp.MinSellThreshold=sell_tr;
		
		//bp.refreshEMA(true);
		if (resetH1) {
			bp.updateH1(true); // call updateH1() with reset==true instead to also reset the H1-array if trading interval or currency has changed (current data in H1 is no good)
		} else {
			bp.refreshEMA(true);
		}
	} catch(e) {
		bp.log("Exception in save(): "+e.stack);
	}
	bp.refreshPopup(true);
}

function setfields() {
	document.getElementById("apikey").value=bp.ApiKey;
	document.getElementById("apisec").value=bp.ApiSec;
	document.getElementById("emas").value=bp.EmaShortPar.toString();
	document.getElementById("emal").value=bp.EmaLongPar.toString();
	//document.getElementById("tras").value=bp.MinThreshold.toFixed(2);
	document.getElementById("buy_tras").value=bp.MinBuyThreshold.toFixed(2);
	document.getElementById("sell_tras").value=bp.MinSellThreshold.toFixed(2);
	
	document.getElementById("currency").value=bp.currency;
	document.getElementById("keepBTC").value=bp.keepBTC.toString();
	
	document.getElementById("tradingEnabled").checked=(bp.tradingEnabled==1);
	document.getElementById("tradingDisabledOnStart").checked=(bp.tradingDisabledOnStart==1);
	
//	console.log("bp.tradingEnabled="+bp.tradingEnabled);
	
//	document.getElementById("keepFiat").value=bp.keepFiat.toString();
	
	
	for (var i=0; i<sla.options.length; i++) {
		if (parseInt(sla.options[i].value)==(bp.LogLines*bp.tradingIntervalMinutes/60)) {
			sla.selectedIndex=i;
			break;
		}
	}

	for (var i=0; i<tradInt.options.length; i++) {
		if (parseInt(tradInt.options[i].value)==bp.tradingIntervalMinutes) {
			tradInt.selectedIndex=i;
			break;
		}
	}

	for (var i=0; i<tc_buy.length; i++) {
    if (tc_buy[i].value==bp.tickCountBuy) {
    	tc_buy.selectedIndex=i;
    	break;
    }
  }
	for (var i=0; i<tc_sell.length; i++) {
    if (tc_sell[i].value==bp.tickCountSell) {
    	tc_sell.selectedIndex=i;
    	break;
    }
  }
  
	for (var i=0; i<currencySelector.length; i++) {
    if (currencySelector[i].value==bp.currencySelector) {
    	currencySelector.selectedIndex=i;
    	break;
    }
  }

  intervalChanged();
}

function intervalChanged() {
	var maxHours=parseInt(bp.MaxSamplesToKeep*parseInt(tradInt.value)/60);
	parseInt(sla.value*60/localStorage.tradingIntervalMinutes);
	var currentSlaValue=parseInt(sla.value);
	
	for (var i=sla.options.length-1; i>=0; i--) {
		if (parseInt(sla.options[i].value)>maxHours) {
			sla.options[i].disabled=true;
			sla.options[i].style.color="#B0B0B0";
		} else {
			sla.options[i].disabled=false;
			sla.options[i].style.color="#000000";
			if (currentSlaValue>maxHours) {
				sla.selectedIndex=i;
				currentSlaValue=sla.options[i].value;
			}
		}
	}			
}

document.addEventListener('DOMContentLoaded', function() {
	butres.addEventListener('click', function(){rese()});
	butsav.addEventListener('click', function(){save()});
	tradingIntervalMinutes.addEventListener('change', function(){intervalChanged()});
	setfields();
/*
	setcontrols();
	setInterval(col, 300);

	spyes.addEventListener('change', function(){sp.readOnly=!spyes.checked})
	butres.addEventListener('click', function(){reset()})
	butsav.addEventListener('click', function(){save()})
	allcur.addEventListener('click', function(){cf.value=''})
	swtchlog.addEventListener('click', function(){chlog.style.display=chlog.style.display=='none'?'block':'none'})
*/
})
