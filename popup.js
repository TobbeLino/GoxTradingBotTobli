var bp = chrome.extension.getBackgroundPage();
var chartVisible=false;
var nowDate;
var nowDateStr;

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
		document.getElementById("ticks").innerHTML=bp.tickCount+" samples"
	else
		document.getElementById("ticks").innerHTML="1 sample";
		
	document.getElementById("buyTres").innerHTML=bp.MinBuyThreshold;
	document.getElementById("sellTres").innerHTML=bp.MinSellThreshold;
	document.getElementById("tradingStatus").innerHTML=(bp.tradingEnabled==1?"<span style=\"color:#008000\"><b>Trading is enabled</b></span>":"<span style=\"color:#A00000\"><b>Trading is disabled</b></span>");
		
	while (tab.rows.length>4)
		tab.deleteRow(4);
		
	nowDate=new Date();
	nowDateStr=nowDate.getFullYear()+"-"+padit(nowDate.getMonth()+1)+"-"+padit(nowDate.getDate());

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
		if (bp.emaLong==null || bp.emaLong.length<bp.H1.length || bp.emaShort==null || bp.emaShort.length<bp.H1.length) {
			bp.refreshEMA(true);
		}
		
		for (var i=bp.H1.length-displayLines; i<bp.H1.length; i++) {
			var el = bp.emaLong[i];
			var es = bp.emaShort[i];
			var perc = 100 * (es-el) / ((es+el)/2);
			var r=tab.insertRow(4);
			//var ti=new Date(bp.tim[i]*3600*1000)
			var d=new Date(bp.tim[i]*60*1000);
			r.title=wds[d.getDay()];
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
	redrawChart();
}

function popupUpdateCounter() {
	var o=document.getElementById("loadCell");
	if (o) {
		o.innerHTML="&nbsp;<br>Fetching trading data - please wait...<br>("+bp.H1.length+" of "+bp.MaxSamplesToKeep+" samples loaded)<br>&nbsp;";
	}
	redrawChart();
}



function redrawChart() {
	if (chartVisible) {
		
		nowDate=new Date();
		nowDateStr=nowDate.getFullYear()+"-"+padit(nowDate.getMonth()+1)+"-"+padit(nowDate.getDate());

		// Calculate the chart scale (max/min of y-value)
		var chartMinY=bp.H1[0];
		var chartMaxY=bp.H1[0];
		for (var i=0;i<bp.H1.length;i++) {
			if (chartMinY>bp.H1[i])
				chartMinY=bp.H1[i];
			if (chartMaxY<bp.H1[i])
				chartMaxY=bp.H1[i];
			
			try {
				if (chartMinY>bp.emaShort[i])
					chartMinY=bp.emaShort[i];
				if (chartMaxY<bp.emaShort[i])
					chartMaxY=bp.emaShort[i];
	
				if (chartMinY>bp.emaLong[i])
					chartMinY=bp.emaLong[i];
				if (chartMaxY<bp.emaLong[i])
					chartMaxY=bp.emaLong[i];
			} catch (e) {
				// Exception - probably because the length of emaShort or emaLong is less that H1 - no big deal...
			}
		}


    // settings: http://omnipotent.net/jquery.sparkline/#s-docs
    $('#EMAChart').sparkline(bp.H1,{
	    type: 'line',
	    lineColor: '#0000FF',
	    fillColor: false,
	    lineWidth: 2,
	    minSpotColor: false,
	    maxSpotColor: false,
	    spotColor: false,
	    composite: false,
	    width: '95%',
	    height: '100px',
	    tooltipContainer: document.getElementById("chart"),
	    tooltipClassname: 'chartTooltip',
	    tooltipFormatter: formatFirstTooltip,
	    highlightLineColor: '#CCC',
	    highlightSpotColor: '#000',
	    xvalues: bp.tim,
	    chartRangeMin: chartMinY,
	    chartRangeMax: chartMaxY
		});
		if (bp.emaShort.length>=bp.H1.length) {
			$('#EMAChart').sparkline(bp.emaShort,{
				lineColor: '#008800',			
				fillColor: false,
				composite: true,
				width: '95%',
				lineWidth: 1,
		    minSpotColor: false,
		    maxSpotColor: false,
				spotColor: false,
				tooltipFormatter: formatEMAShortTooltip,
				highlightLineColor: '#CCC',
				highlightSpotColor: '#000',
				xvalues: bp.tim,
		    chartRangeMin: chartMinY,
		    chartRangeMax: chartMaxY				
			});
		}
		if (bp.emaLong.length>=bp.H1.length) {
			$('#EMAChart').sparkline(bp.emaLong,{
				lineColor: '#B00000',
				fillColor: false,
				composite: true,
				width: '95%',
				lineWidth: 1,
		    minSpotColor: false,
		    maxSpotColor: false,
				spotColor: false,
				tooltipFormatter: formatEMALongTooltip,
				highlightLineColor: '#CCC',
				highlightSpotColor: '#000',
				xvalues: bp.tim,
		    chartRangeMin: chartMinY,
		    chartRangeMax: chartMaxY				
			});
		}
	}
}

function formatChartNumbers(v) {
	return v.toFixed(3);
}

function formatFirstTooltip(sp, options, fields){
	var d=new Date(fields.x*60*1000);
	var dateStr=d.getFullYear()+"-"+padit(d.getMonth()+1)+"-"+padit(d.getDate());
	var t=(dateStr!=nowDateStr?dateStr:"Today")+" "+padit(d.getHours()) + ":"+padit(d.getMinutes());
  return '<div align="center">'+t+ '<table width="100%" border="0"><tr><td align="left" class="tooltipTableCell"><span style="color: '+fields.color+'">&#9679;</span> Price: '+formatChartNumbers(fields.y)+'<br>';
}

var lastEmaTime=0;
var lastEmaShort=0;
function formatEMAShortTooltip(sp, options, fields){
	lastEmaTime=fields.x;
	lastEmaShort=fields.y;	
  return '<span style="color: '+fields.color+'">&#9679;</span> EMA'+bp.EmaShortPar+': '+formatChartNumbers(fields.y)+'<br>';
}

function formatEMALongTooltip(sp, options, fields){
    var trend='?';

    //
    // Display EMA S/L %. Helpful for gauging on the graph when trades execute on new trend directions.
    // Round to 3 decimal places.
    //
    var trendIndicator=((lastEmaShort-fields.y) / ((lastEmaShort+fields.y)/2)) * 100;

    if (lastEmaTime==fields.x) {
    	if (trendIndicator>0)
    		trend='<img class="trendIndicatorImg" src="trend_'+(trendIndicator>bp.MinBuyThreshold?'strong':'weak')+'_up.gif">';
    	else if (trendIndicator<0)
    		trend='<img class="trendIndicatorImg" src="trend_'+(-trendIndicator>bp.MinSellThreshold?'strong':'weak')+'_down.gif">';
    	else
    		trend='none';
    }

    return '<span style="color: '+fields.color+'">&#9679;</span> EMA'+bp.EmaLongPar+': '+formatChartNumbers(fields.y)+'</td></tr></table>Trend: '+trend+' '+formatChartNumbers(trendIndicator)+'%';
}

function toggleChart() {
	if (document.getElementById("chart").style.display=="none") {
		document.getElementById("chart").style.display="block";
		chartVisible=true;
	} else {
		document.getElementById("chart").style.display="none";
		chartVisible=false;
	}
	redrawChart();
}

refreshtable();
bp.popupRefresh=refreshtable;
bp.popupUpdateCounter=popupUpdateCounter;

document.addEventListener('DOMContentLoaded', function() {
	chartLink.addEventListener('click', function(){toggleChart()});
})
