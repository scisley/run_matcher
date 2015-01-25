
var xmlData;
var mapA;
var mapB;
var Data = {};

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
	var ways_xml = data.getElementsByTagName("way");
	var nodes_xml = data.getElementsByTagName("node");
	
	// Get the lon/lat pairs for each node
	var nodes = {};
	$.map(nodes_xml, function(val, i) {
		nodes[val.getAttribute("id")] = {lon: val.getAttribute("lon"), 
		                                 lat: val.getAttribute("lat"),
										 point: L.latLng( val.getAttribute("lat"), val.getAttribute("lon") ),
										 id:  val.getAttribute("id") };
	});
	
	// This is how many nodes got returned in the data set
	console.log("Node count:" + _.size(nodes));
	
	// Create a segment object for each way found in the xml, and link the nodes created earlier
	var segments = {};
	$.map(ways_xml, function(val, i) {
		var segment = {segment_id: val.getAttribute("id"), points: [], nodes:[]};
		$.map( val.getElementsByTagName("nd"), function(nd, i) {
			var nd_id = nd.getAttribute("ref");
			segment.points.push( nodes[nd_id].point );
			segment.nodes.push( nodes[nd_id] );
		});
		segments[val.getAttribute("id")] = segment;
	});
	
	// Plot the segments on the map
	for (id in segments) {
		var polyline = L.polyline(segments[id].points, {color: rndColor() }).addTo(target_map);
		polyline.bindPopup("Route " + id + ", bounded by " + polyline.getBounds().toBBoxString());
	}
	
	// For each node, add what segments it is a member of
	for (id in nodes) {
		nodes[id].segments = _.filter(segments, function(segment){ 
			var matches = _.find(segment.nodes, function(nd){ 
				return(nd.id === id); });
			return(typeof  matches != "undefined"); 
		});
	}
	
	// Add distance information to each segment
	$.map(segments, function(segment, i) {
		var d = 0;
		for (var i=1; i<segment.points.length; i++) {
			d += segment.points[i].distanceTo(segment.points[i-1]);
		}
		segment.distance = d;
		return(d);
	});
	
	console.log("Number of segments: " + _.size(segments) );
	console.log(nodes);
	crit = makeAdjacencyList(segments, nodes);
	
	// For debugging, plot the critical points
	$.map(crit, function(node) {
		var circle = L.circle(node.point,12);
		circle.bindPopup("Node Id:" + node.id);
		circle.addTo(target_map);
	});
	Data.crit = crit;
	
	// For debugging, plot the critical point neighbour links
	var lines = [];
	$.map(crit, function(node) {
		$.map(node.nbr, function(nbr) {
			lines.push( [node.point, nbr.point] );
		});
	});
	L.multiPolyline( lines, {weight:2, color:"black"} ).addTo(target_map);
	
	
};

var makeAdjacencyList = function(segments, nodes) {
/*
	What I want: A set of critical nodes, we'll call them intersections, and the other critical
	nodes they connect to. For each critical node, list the other critical nodes it connects to and
	provide a link to the route it uses to do that, along with the distance.

	I need to generate an adjacency list. If two segments connect at end points, then it's not a 
	real intersection, but if 3 segments connect at end points then it is. If a node is shared by
	two segments, with either segment including the node at a non-end point, then it's an intersection.
	any node at the end of a segment that is unique is also an intersection (a dead end)
	
	Steps:
		* Make a new array of candidate critical points. Start by adding all the nodes that
		  are members of more than one segment. Next, add the start and end point of each
		  segment. Remove all duplicates.
		* For each critical point, find the nearest other critical points in each segment.
		  These are it's nearest neighbours. 
		* Calculate distance between each critical point and it's neighbours.
*/
	
	// Add nodes that appear in multiple segments (likely intersections)
	var crit = _.filter(nodes, function(node) {
		return node.segments.length > 1;
	});
	console.log(crit);
	
	// Add start and end points of each segment to critical point list
	boundary_nodes = $.map(segments, function(segment, i) {
		return [segment.nodes[0], segment.nodes[segment.nodes.length-1]];
	});
	crit = _.union(crit, _.flatten(boundary_nodes));
	crit = _.uniq(crit, function(item) { return item.id; });
	console.log(crit);
	
	// For each critical point, look at the segments, find itself in the segment, then search 
	// for new critical points either up or down in the list. Those are the neighbours
	$.map(crit, function(cp) {
		cp.nbr = [];
		cp.nbr_dist = [];
		$.map(cp.segments, function(segment) {
			var q = _.indexOf(_.pluck(segment.nodes, "id"), cp.id);
			// Look for the first prior critical point
			d = 0;
			for (var p=q-1; p >= 0; p--) {
				d += segment.points[p].distanceTo(segment.points[p+1]);
				if (Boolean(_.find(crit, segment.nodes[p], function(x) { return x.id; }))) {
					cp.nbr.push(segment.nodes[p]);
					cp.nbr_dist.push(d);
					break;
				}
			}
			
			// Look for the first latter critical point
			d=0;
			for (var p=q+1; p < segment.nodes.length; p++) {
				d += segment.points[p].distanceTo(segment.points[p-1]);
				if (Boolean(_.find(crit, segment.nodes[p], function(x) { return x.id; }))) {
					cp.nbr.push(segment.nodes[p]);
					cp.nbr_dist.push(d);
					break;
				}
			}
		});
	});
	
	// Remove any duplicates. It is possible for two critical points to be linked together by
	// two different segments.
	// WAIT! If two critical points are connected via different segments, we want it listed twice
	// along with it's distance for each segment.
	//$.map(crit, function(cp) { cp.nbr = _.uniq(cp.nbr, function(x) { return x.id; }); });
	
	// What does the distribution of neighbour count look like?
	// _.countBy(Data.crit, function(x) { return x.nbr.length; })
	
	
	console.log(crit)
	
	
	return crit;
};

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
