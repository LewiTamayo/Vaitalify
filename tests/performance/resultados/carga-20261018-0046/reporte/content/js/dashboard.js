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

    var data = {"OkPercent": 49.345569429817964, "KoPercent": 50.654430570182036};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.0352790732661351, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.04235382308845577, 500, 1500, "GET /progreso/semanal"], "isController": false}, {"data": [0.016203703703703703, 500, 1500, "POST /registros-sueno"], "isController": false}, {"data": [0.365, 500, 1500, "POST /auth/login"], "isController": false}, {"data": [0.01084010840108401, 500, 1500, "DELETE /bloques/{id}"], "isController": false}, {"data": [0.0517503805175038, 500, 1500, "GET /sueno/recomendacion"], "isController": false}, {"data": [0.04504504504504504, 500, 1500, "GET /micro-pausas/hoy"], "isController": false}, {"data": [0.0, 500, 1500, "PATCH /micro-pausas/{id}"], "isController": false}, {"data": [0.003033367037411527, 500, 1500, "POST /bloques"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 6647, 3367, 50.654430570182036, 6206.759139461405, 0, 15003, 5653.0, 14906.199999999999, 15001.0, 15002.0, 10.8785843929056, 14.210037067299272, 3.717259247696872], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["GET /progreso/semanal", 1334, 670, 50.22488755622189, 4714.836581709143, 0, 10115, 5014.0, 8819.0, 9365.25, 9936.800000000001, 2.2074324615023118, 2.3606775444216823, 0.7990682636905491], "isController": false}, {"data": ["POST /registros-sueno", 648, 228, 35.18518518518518, 6855.905864197527, 0, 15002, 8572.0, 12806.4, 13691.05, 14537.81, 1.0820884306711955, 1.0673284986899716, 0.45070873504613906], "isController": false}, {"data": ["POST /auth/login", 100, 6, 6.0, 3577.6699999999996, 337, 10203, 2367.0, 8177.700000000001, 9225.799999999997, 10202.97, 0.7929962570576667, 1.1178923993291252, 0.26407394888346125], "isController": false}, {"data": ["DELETE /bloques/{id}", 369, 151, 40.921409214092144, 11340.067750677517, 1318, 15003, 13104.0, 15001.0, 15001.0, 15002.3, 0.6203588666766416, 0.8669831041522015, 0.17578607685220832], "isController": false}, {"data": ["GET /sueno/recomendacion", 657, 267, 40.63926940639269, 2597.6757990867586, 0, 5310, 2943.0, 5009.0, 5017.0, 5076.42, 1.1073805141481765, 1.2364471773595462, 0.3991483509595612], "isController": false}, {"data": ["GET /micro-pausas/hoy", 1998, 919, 45.995995995996, 4853.743743743745, 0, 10129, 5640.0, 8998.2, 9589.9, 10064.0, 3.3184572993603916, 4.626448360556697, 1.1960286158810935], "isController": false}, {"data": ["PATCH /micro-pausas/{id}", 552, 516, 93.47826086956522, 10444.344202898554, 0, 15003, 13585.0, 15001.0, 15002.0, 15003.0, 0.9109301719215676, 1.6161271848090841, 0.17627870585206626], "isController": false}, {"data": ["POST /bloques", 989, 610, 61.67846309403438, 8910.13751263903, 0, 15003, 12462.0, 15001.0, 15002.0, 15003.0, 1.6413793561278716, 2.4259006529835263, 0.5259455720514088], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["500/Internal Server Error", 1180, 35.046035046035044, 17.752369489995488], "isController": false}, {"data": ["Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 62, 1.8414018414018414, 0.9327516172709494], "isController": false}, {"data": ["401/Unauthorized", 1477, 43.86694386694387, 22.220550624341808], "isController": false}, {"data": ["Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 648, 19.245619245619245, 9.748758838573792], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 6647, 3367, "401/Unauthorized", 1477, "500/Internal Server Error", 1180, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 648, "Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 62, "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["GET /progreso/semanal", 1334, 670, "500/Internal Server Error", 340, "401/Unauthorized", 330, "", "", "", "", "", ""], "isController": false}, {"data": ["POST /registros-sueno", 648, 228, "401/Unauthorized", 179, "500/Internal Server Error", 47, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 2, "", "", "", ""], "isController": false}, {"data": ["POST /auth/login", 100, 6, "500/Internal Server Error", 6, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["DELETE /bloques/{id}", 369, 151, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 120, "500/Internal Server Error", 31, "", "", "", "", "", ""], "isController": false}, {"data": ["GET /sueno/recomendacion", 657, 267, "401/Unauthorized", 181, "500/Internal Server Error", 86, "", "", "", "", "", ""], "isController": false}, {"data": ["GET /micro-pausas/hoy", 1998, 919, "401/Unauthorized", 514, "500/Internal Server Error", 405, "", "", "", "", "", ""], "isController": false}, {"data": ["PATCH /micro-pausas/{id}", 552, 516, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 248, "500/Internal Server Error", 206, "Non HTTP response code: java.net.URISyntaxException/Non HTTP response message: Illegal character in path at index 43: http://localhost:3000/api/v1/micro-pausas/${idPausa}", 62, "", "", "", ""], "isController": false}, {"data": ["POST /bloques", 989, 610, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 278, "401/Unauthorized", 273, "500/Internal Server Error", 59, "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
