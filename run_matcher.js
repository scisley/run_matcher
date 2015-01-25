
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
	alist = makeAdjacencyList(segments, nodes);
	
	// For debugging, plot the critical points
	$.map(alist, function(node) {
		var circle = L.circle(node.point,12);
		circle.bindPopup("Node Id:" + node.id);
		circle.addTo(target_map);
	});
	Data.crit = alist;
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
		* Make a new array of candidate critical points. Start by adding all start
		  and end points for each segment.
		* Next, add all non-unique remaining points.
		* For each remaining point, add as neighbours the end node from each segment
		  the node is a member
		* For each candidate critical point, check if it only has two neighbours.
		  If so, it is redundant. For each of its two neighbours, remove it and
		  add the opposite neighbour with the correct distance. Then remove the
		  redundant point	
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
		cp.neighbours = [];
		$.map(cp.segments, function(segment) {
			var q = _.indexOf(_.pluck(segment.nodes, "id"), cp.id);
			//console.log(cp.id + ":" + segment.segment_id + ":" + i);
			// Look for the first prior critical point
			var prior = _.first(segment.nodes, q);
			for (p in prior.reverse()) {
				if (Boolean(_.find(crit, prior[p], function(x) { return x.id; }))) {
					cp.neighbours.push(prior[p]);
					break;
				}
			}
			// Look for the first latter critical point
			var latter = _.rest(segment.nodes, q+1);
			for (p in latter) {
				if (Boolean(_.find(crit, latter[p], function(x) { return x.id; }))) {
					cp.neighbours.push(latter[p]);
					break;
				}
			}
		});
	});
	
	// What does the distribution of neighbour count look like?
	// _.countBy(Data.crit, function(x) { return x.neighbours.length; })
	
/* 	//Grab all the segments and combine them into a big list of node id's
	all_nodes = _.flatten(_.pluck(segments, "nodes"));	
	all_nodes = $.map(all_nodes, function(node,i) {
		return node.id;
	});
	
	// Find those nodes that appear multiple times
	var node_counts = _.countBy(all_nodes, function(num) { return num; } );
	var crit_nodes = [];
	for (id in node_counts) if (node_counts[id] > 1) crit_nodes.push(id); 
	console.log(crit_nodes);
	
	// Add the beginning and ending node in every segment.
	boundary_nodes = $.map(segments, function(segment, i) {
		return [segment.nodes[0].id,segment.nodes[segment.nodes.length-1].id];
	});
	
	crit_nodes = _.union(crit_nodes, _.flatten(boundary_nodes));
	console.log(crit_nodes) */
	
	
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
	//fetchOsm(mapB, "-122.1309,47.6874,-122.0974,47.7040" );
	
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
