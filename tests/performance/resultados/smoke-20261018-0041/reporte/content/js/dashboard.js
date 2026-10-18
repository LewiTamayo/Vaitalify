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

    var data = {"OkPercent": 97.0, "KoPercent": 3.0};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.665, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.8888888888888888, 500, 1500, "GET /progreso/semanal"], "isController": false}, {"data": [0.5, 500, 1500, "POST /registros-sueno"], "isController": false}, {"data": [0.8, 500, 1500, "POST /auth/login"], "isController": false}, {"data": [0.4090909090909091, 500, 1500, "DELETE /bloques/{id}"], "isController": false}, {"data": [1.0, 500, 1500, "GET /sueno/recomendacion"], "isController": false}, {"data": [1.0, 500, 1500, "GET /micro-pausas/hoy"], "isController": false}, {"data": [0.0, 500, 1500, "PATCH /micro-pausas/{id}"], "isController": false}, {"data": [0.4166666666666667, 500, 1500, "POST /bloques"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 100, 3, 3.0, 728.0400000000001, 0, 2206, 278.5, 1842.800000000001, 1952.75, 2205.6699999999996, 1.6819726174857874, 2.142790408340902, 0.6890831567262085], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["GET /progreso/semanal", 18, 0, 0.0, 267.5555555555556, 155, 814, 169.0, 598.0000000000003, 814.0, 814.0, 0.323502453226937, 0.3708027522420517, 0.129843269801046], "isController": false}, {"data": ["POST /registros-sueno", 8, 0, 0.0, 1041.5, 990, 1141, 1021.5, 1141.0, 1141.0, 1141.0, 0.1666770839844157, 0.1614684251099027, 0.07699048898889514], "isController": false}, {"data": ["POST /auth/login", 5, 0, 0.0, 491.6, 371, 827, 377.0, 827.0, 827.0, 827.0, 0.6462453147214682, 0.9283465409719529, 0.2152047385937702], "isController": false}, {"data": ["DELETE /bloques/{id}", 11, 0, 0.0, 1399.4545454545453, 1215, 1580, 1395.0, 1578.0, 1580.0, 1580.0, 0.25986912046114957, 0.199977409104869, 0.1091247283186468], "isController": false}, {"data": ["GET /sueno/recomendacion", 8, 0, 0.0, 83.37499999999999, 78, 91, 81.5, 91.0, 91.0, 91.0, 0.17174753112924002, 0.2054596930012881, 0.06943699012451696], "isController": false}, {"data": ["GET /micro-pausas/hoy", 25, 0, 0.0, 166.12, 152, 186, 161.0, 179.8, 184.5, 186.0, 0.4980873445967485, 0.8830154705929232, 0.19991591663014027], "isController": false}, {"data": ["PATCH /micro-pausas/{id}", 13, 3, 23.076923076923077, 1541.4615384615386, 0, 2206, 1905.0, 2192.8, 2206.0, 2206.0, 0.24834753371795362, 0.3260494175772743, 0.08432473350399267], "isController": false}, {"data": ["POST /bloques", 12, 0, 0.0, 1412.0833333333333, 1216, 1652, 1402.0, 1633.1000000000001, 1652.0, 1652.0, 0.24867889337892446, 0.2571786602424619, 0.1260394000621697], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 3, 100.0, 3.0], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 100, 3, "Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 3, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["PATCH /micro-pausas/{id}", 13, 3, "Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 3, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
