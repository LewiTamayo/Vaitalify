/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 99.70285936967217, "KoPercent": 0.29714063032782895};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.7131618685761606, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9899046550757151, 500, 1500, "GET /progreso/semanal"], "isController": false}, {"data": [0.5395256916996047, 500, 1500, "POST /registros-sueno"], "isController": false}, {"data": [0.925, 500, 1500, "POST /auth/login"], "isController": false}, {"data": [0.4930003783579266, 500, 1500, "DELETE /bloques/{id}"], "isController": false}, {"data": [0.9954954954954955, 500, 1500, "GET /sueno/recomendacion"], "isController": false}, {"data": [0.1306626731561213, 500, 1500, "PATCH /micro-pausas/{id}"], "isController": false}, {"data": [0.9987839101964453, 500, 1500, "GET /micro-pausas/hoy"], "isController": false}, {"data": [0.49077907414377114, 500, 1500, "POST /bloques"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 20529, 61, 0.29714063032782895, 630.8236640849509, 0, 2357, 112.0, 1497.0, 1595.9500000000007, 1775.0, 34.29805846491587, 43.16430005444435, 14.626339715699018], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["GET /progreso/semanal", 3566, 0, 0.0, 106.67190128996073, 76, 816, 93.0, 106.0, 140.64999999999964, 574.3299999999999, 6.008981455737263, 6.960053888207836, 2.411807986628921], "isController": false}, {"data": ["POST /registros-sueno", 1771, 0, 0.0, 931.1710897797839, 72, 1705, 966.0, 1108.0, 1163.3999999999999, 1357.1999999999996, 3.0154946364719906, 2.936727795632556, 1.3928993779797378], "isController": false}, {"data": ["POST /auth/login", 100, 0, 0.0, 404.71999999999997, 328, 999, 359.0, 538.3000000000001, 693.4499999999982, 998.1299999999995, 0.8367780697203487, 1.2028031019363044, 0.2786536345455458], "isController": false}, {"data": ["DELETE /bloques/{id}", 2643, 0, 0.0, 1142.365493757093, 914, 1811, 1122.0, 1288.0, 1352.5999999999995, 1547.0, 4.4740797919882995, 3.442944214928496, 1.8787639751513368], "isController": false}, {"data": ["GET /sueno/recomendacion", 1776, 0, 0.0, 94.40427927927918, 70, 740, 86.0, 96.0, 111.14999999999986, 356.3800000000019, 3.0130957692810134, 3.6045335130559, 1.2181852035960348], "isController": false}, {"data": ["PATCH /micro-pausas/{id}", 2671, 61, 2.283788843129914, 1559.1819543242248, 0, 2357, 1545.0, 1759.8000000000002, 1827.4, 2080.5600000000004, 4.484101668737199, 6.078869578492765, 1.934107229795521], "isController": false}, {"data": ["GET /micro-pausas/hoy", 5345, 0, 0.0, 92.5446211412535, 70, 781, 86.0, 98.0, 113.0, 245.0, 8.999407335569293, 15.674855119749363, 3.6120668114443166], "isController": false}, {"data": ["POST /bloques", 2657, 0, 0.0, 1141.9085434700764, 922, 2029, 1119.0, 1287.0, 1352.1999999999998, 1570.6800000000003, 4.470858650530967, 4.623671202062787, 2.2659918355718474], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 61, 100.0, 0.29714063032782895], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 20529, 61, "Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 61, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["PATCH /micro-pausas/{id}", 2671, 61, "Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 61, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
