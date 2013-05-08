var bp = chrome.extension.getBackgroundPage();
function padit(d) {return d<10 ? '0'+d.toString() : d.toString()};
function refreshtable() {
	const wds = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
	const bcols = ["#f2f2ff", "#fffff0"];
	var lastBgCol=0;
	var lastDate="";
	var tab = document.getElementById("tab");
	document.getElementById("emal").innerHTML=bp.EmaLongPar;
	document.getElementById("emas").innerHTML=bp.EmaShortPar;

	if (bp.tradingIntervalMinutes>59)
		document.getElementById("int").innerHTML=parseInt(bp.tradingIntervalMinutes/60)+" hour"+(bp.tradingIntervalMinutes>119?"s":"")
	else
		document.getElementById("int").innerHTML=bp.tradingIntervalMinutes+" min";

	if (bp.tickCount>1)
		document.getElementById("ticks").innerHTML=bp.tickCount+ "samples"
	else
		document.getElementById("ticks").innerHTML="1 sample";
		
	document.getElementById("buyTres").innerHTML=bp.MinBuyThreshold;
	document.getElementById("sellTres").innerHTML=bp.MinSellThreshold;
	document.getElementById("tradingStatus").innerHTML=(bp.tradingEnabled==1?"<span style=\"color:#008000\"><b>Trading is enabled</b></span><br>":"<span style=\"color:#A00000\"><b>Trading is disabled</b></span><br>");
		
	while (tab.rows.length>4)
		tab.deleteRow(4);
		
	var nowDate=new Date();
	var nowDateStr=nowDate.getFullYear()+"-"+padit(nowDate.getMonth()+1)+"-"+padit(nowDate.getDate());

	var displayLines=Math.min(bp.H1.length,bp.LogLines);
	if (bp.updateinprogress) { // && bp.H1.length>bp.LogLines) {
		var r=tab.insertRow(4);
		var c=r.insertCell(-1);
		c.colSpan=5;
		c.innerHTML="&nbsp;<br>Fetching trading data - please wait...<br>("+bp.H1.length+" of "+bp.MaxSamplesToKeep+" samples loaded)<br>&nbsp;";
		c.style.backgroundColor="#FFFFFF";
		c.style.textAlign="center";
		c.id="loadCell";
	} else { // && bp.H1.length>bp.LogLines) {
		//for (var i=bp.H1.length-bp.LogLines; i<bp.H1.length; i++) {
		for (var i=bp.H1.length-displayLines; i<bp.H1.length; i++) {
			var el = bp.emaLong[i];
			var es = bp.emaShort[i];
			var perc = 100 * (es-el) / ((es+el)/2);
			var r=tab.insertRow(4);
			//var ti=new Date(bp.tim[i]*3600*1000)
			var ti=new Date(bp.tim[i]*60*1000);
			r.title=wds[ti.getDay()];
			var d=new Date(bp.tim[i]*60*1000);
			var dateStr=d.getFullYear()+"-"+padit(d.getMonth()+1)+"-"+padit(d.getDate());
			var date=d.getDate()+"/"+(d.getMonth()+1)+" ";
			//r.style.backgroundColor=bcols[((bp.tim[i]+1)/24)&1]
			if (lastDate!=date) {
				lastBgCol=1-lastBgCol;
				lastDate=date;
			}
			
			r.style.backgroundColor=bcols[lastBgCol];

			//r.insertCell(-1).innerHTML=(new Date(bp.tim[i]*3600*1000)).getHours() + ":00"
			//r.insertCell(-1).innerHTML=d.getFullYear()+"-"+padit(d.getMonth()+1)+"-"+padit(d.getDate())+" "+ padit(d.getHours()) + ":"+padit(d.getMinutes());
			
			r.insertCell(-1).innerHTML=(dateStr!=nowDateStr?date:"")+padit(d.getHours()) + ":"+padit(d.getMinutes());
			r.insertCell(-1).innerHTML=bp.H1[i].toFixed(3);
			r.insertCell(-1).innerHTML=es.toFixed(3);
			r.insertCell(-1).innerHTML=el.toFixed(3);
			var c=r.insertCell(-1);
			c.innerHTML=perc.toFixed(3)+'%';
			if (perc>bp.MinBuyThreshold || perc<-bp.MinSellThreshold) {
				c.style.backgroundColor = perc<0 ? "#ffd0d0" : "#d0ffd0";
			} else {
				c.style.backgroundColor = perc<0 ? "#fff0f0" : "#f0fff0";
			}
		}
	}

	if (isNaN(bp.fiat) || isNaN(bp.BTC)) {
		document.getElementById("nobalan").style.display="table-row";
		document.getElementById("balance").style.display="none";
	} else {
		document.getElementById("nobalan").style.display="none";
		document.getElementById("balance").style.display="table-row";
		document.getElementById("usd").innerHTML=bp.fiat.toFixed(2)+" "+ bp.currency;
		document.getElementById("btc").innerHTML=bp.BTC.toFixed(2);
	}
}

function popupUpdateCounter() {
	var o=document.getElementById("loadCell");
	if (o) {
		o.innerHTML="&nbsp;<br>Fetching trading data - please wait...<br>("+bp.H1.length+" of "+bp.MaxSamplesToKeep+" samples loaded)<br>&nbsp;";
	}
}

refreshtable();
bp.popupRefresh=refreshtable;
bp.popupUpdateCounter=popupUpdateCounter;