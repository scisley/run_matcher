
var xmlData;
var mapA;
var mapB;

var fetchOsm = function(target_map, bbox) {
	$.ajax({
		url: "http://overpass.osm.rambler.ru/cgi/xapi_meta",
		dataType: "xml",
		data: "way[highway=*][bbox="+bbox +"]",
		success: function( data ) {
			xmlData = data;
			console.log(data)
			//$( "#ajax" ).text( (new XMLSerializer()).serializeToString(data) );
			addOsmToMap(target_map, data);
		},
		error: function() {
			$( "#ajax" ).html( "<strong>" + "Error!" + "</strong>" );
		}
	});
}
	  
var addOsmToMap = function(target_map, data) {
	var ways = data.getElementsByTagName("way");
	var nodes = data.getElementsByTagName("node");
	
	// Match all the nd's in the way with the lon/lat's in nodes
	
	// Get the lon/lat pairs for each node
	var gps_node = {};
	$.map(nodes, function(val, i) {
		gps_node[val.getAttribute("id")] = {lon: val.getAttribute("lon"), lat: val.getAttribute("lat")};
	});
	
	var gps_ways = $.map(ways, function(val, i) {
		var way_nodes = {way_id: val.getAttribute("id"), points: []};
		$.map( val.getElementsByTagName("nd"), function(nd, i) {
			var nd_id = nd.getAttribute("ref");
			way_nodes.points.push( L.latLng( gps_node[nd_id]["lat"], gps_node[nd_id]["lon"] ) );
		});
		var polyline = L.polyline(way_nodes.points, {color: rndColor() }).addTo(target_map);
		polyline.bindPopup(polyline.getBounds().toBBoxString());
		return( polyline );
	});
	
	console.log( gps_ways[1] );
}

var rndColor = function() {
	return('#'+Math.floor(Math.random()*16777215).toString(16));
};

$(document).ready(function() {	
	mapA = L.map('mapA');
	var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
	var osmA = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 18, attribution: osmAttrib});		

	// start near my house
	mapA.setView(new L.LatLng(39.74535, -105.17465),14);
	mapA.addLayer(osmA);
	
	mapB = L.map('mapB');
	var osmB = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 18, attribution: osmAttrib});		
	mapB.setView(new L.LatLng(47.69569, -122.11453),14);
	mapB.addLayer(osmB);
	
	fetchOsm(mapA, "-105.1847,39.7372,-105.1646,39.7535" );
	fetchOsm(mapB, "-122.1309,47.6874,-122.0974,47.7040" );
	
	//GET pqs.php?x=string&y=string&units=string&output=string HTTP/1.1
	//Host: ned.usgs.gov/epqs/pqs.php

/* 	$.ajax({
		url: "ned.usgs.gov/epqs/pqs.php",
		dataType: "xml",
		data: {y: "39.74535", x: "-105.17465"},
		success: function( data ) {
			xmlData = data;
			console.log(data)
			//$( "#ajax" ).text( (new XMLSerializer()).serializeToString(data) );
			addOsmToMap(target_map, data);
		},
		error: function() {
			$( "#ajax" ).html( "<strong>" + "Error!" + "</strong>" );
		}
	}); */
	
	/*
	var circle = L.circle([39.74535, -105.17465], 50, {
		color: 'blue',
		fillColor: '#f03',
		fillOpacity: 0.5
	}).addTo(mapA);
	*/
	// Documentation of how to add points: http://leafletjs.com/examples/quick-start.html
	
});
