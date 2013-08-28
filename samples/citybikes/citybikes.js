var dataproviderbase = require("../../src/dataproviderbase"),
	util = require("util"),
	http = require("http"),
	path = require("path"),
	fs = require("fs");

var esribikeshare = require("./resources/esribikeshare.js");

var cityBikesNetworksURL = "http://api.citybik.es/networks.json";
var newMapTemplate = "http://www.arcgis.com/home/webmap/viewer.html?url=%s&source=sd";

var networksFields = [
	{"name" : "id", "type" : "esriFieldTypeInteger", "alias" : "ID", "nullable" : "true"},
	{"name" : "name", "type" : "esriFieldTypeString", "alias" : "Name", "length" : "255", "nullable" : "true"},
	{"name" : "apiurl", "type" : "esriFieldTypeString", "alias" : "CityBik.es URL", "length" : null, "nullable" : "true"},
	{"name" : "url", "type" : "esriFieldTypeString", "alias" : "Service URL", "length" : null, "nullable" : "true"},
	{"name" : "agolmap", "type" : "esriFieldTypeString", "alias" : "View In New Map", "length" : null, "nullable" : "true"},
	{"name" : "stations", "type" : "esriFieldTypeInteger", "alias" : "Stations", "nullable" : "true"},
	{"name" : "docks", "type" : "esriFieldTypeInteger", "alias" : "Open Docks", "nullable" : "true"},
	{"name" : "bikes", "type" : "esriFieldTypeInteger", "alias" : "Docked Bikes", "nullable" : "true"},
	{"name" : "citybikesTimeString", "type" : "esriFieldTypeString", "alias" : "CityBikes Time", "length" : "255", "nullable" : "true"},
	{"name" : "utcTime", "type" : "esriFieldTypeDate", "alias" : "UTC Timestamp", "length" : 36, "nullable" : "true"},
	{"name" : "timezone", "type" : "esriFieldTypeString", "alias" : "Timezone Code", "length" : "5", "nullable" : "true"},
	{"name" : "timezoneOffset", "type" : "esriFieldTypeInteger", "alias" : "Timezone Offset", "nullable" : "true"},
	{"name" : "timezoneOffsetString", "type" : "esriFieldTypeString", "alias" : "Timezone Offset String", "length" : "8", "nullable" : "true"},
	{"name" : "localTimeString", "type" : "esriFieldTypeString", "alias" : "Local Time", "length" : "255", "nullable" : "true"},
];


var cityBikesFields = [
	{"name" : "id", "type" : "esriFieldTypeInteger", "alias" : "ID", "nullable" : "true"},
	{"name" : "idx", "type" : "esriFieldTypeInteger", "alias" : "IDX", "nullable" : "true"},
	{"name" : "name", "type" : "esriFieldTypeString", "alias" : "Name", "length" : "255", "nullable" : "true"},
	{"name" : "number", "type" : "esriFieldTypeInteger", "alias" : "Number", "nullable" : "true"},
	{"name" : "free", "type" : "esriFieldTypeInteger", "alias" : "Free", "nullable" : "true"},
	{"name" : "bikes", "type" : "esriFieldTypeInteger", "alias" : "Bikes", "nullable" : "true"},
	{"name" : "bikesClass", "type" : "esriFieldTypeString", "alias" : "Bikes Class", "length" : "255", "nullable" : "true"},
	{"name" : "docksClass", "type" : "esriFieldTypeString", "alias" : "Docks Class", "length" : "255", "nullable" : "true"},
	{"name" : "address", "type" : "esriFieldTypeString", "alias" : "Address", "length" : "255", "nullable" : "true"},
	{"name" : "citybikesTimeString", "type" : "esriFieldTypeString", "alias" : "CityBikes Time", "length" : "255", "nullable" : "true"},
	{"name" : "utcTime", "type" : "esriFieldTypeDate", "alias" : "UTC Timestamp", "length" : 36, "nullable" : "true"},
	{"name" : "timezone", "type" : "esriFieldTypeString", "alias" : "Timezone Code", "length" : "5", "nullable" : "true"},
	{"name" : "timezoneOffset", "type" : "esriFieldTypeInteger", "alias" : "Timezone Offset", "nullable" : "true"},
	{"name" : "timezoneOffsetString", "type" : "esriFieldTypeString", "alias" : "Timezone Offset String", "length" : "8", "nullable" : "true"},
	{"name" : "localTimeString", "type" : "esriFieldTypeString", "alias" : "Local Time", "length" : "255", "nullable" : "true"},
];

var bikeClassificationScheme = {
	"0": { "min": 0, "max": 0, "label": "No bikes" },
	"1": { "min": 1, "max": 1, "label": "1 bike" },
	"few": { "min": 2, "max": 8, "label": "A few bikes" },
	"plenty": { "min": 9, "max": 10000, "label": "Plenty of bikes" }
};
	
var dockClassificationScheme = {
	"0": { "min": 0, "max": 0, "label": "No docks" },
	"1": { "min": 1, "max": 1, "label": "1 dock" },
	"2": { "min": 2, "max": 2, "label": "2 docks" },
	"3": { "min": 3, "max": 3, "label": "3 docks" },
	"4": { "min": 4, "max": 4, "label": "4 docks" },
	"few": { "min": 5, "max": 10, "label": "5-10 docks" },
	"plenty": { "min": 11, "max": 10000, "label": "Plenty of docks" }
};

var featureFilterFunctions = {
	"cristolib": function(item) {
		return !(item.attributes.bikes == 0 && item.attributes.free == 0);
	}
};

var drawingInfo = JSON.parse(fs.readFileSync(path.join(path.dirname(module.filename),"resources","templates","layerDefinition-drawingInfo.json"), 'utf8'));

var timezoneAPIKey = "IMPMC00M2XNY"; // Replace this with your own key from timezonedb.com

var timezoneCacheFilename = path.join(path.dirname(module.filename),"data","timezones.json");

var allNetworksServiceId = "world_bikeshares",
	allNetworksServiceName = "World Bikeshares",
	allNetworksAllDataLayerId = 0,
	allNetworksAllDataLayerName = "All Bikeshares",
	allNetworksGoodDataLayerId = 1,
	allNetworksGoodDataLayerName = "Bikeshares with Stations";
	
var extentMinWidth = 0.1, // In 4326 units (decimal degrees)
	extentMinHeight = 0.1; // In 4326 units (decimal degrees)

var states = {
	empty: "empty",
	loading: "loading",
	loaded: "loaded"
};

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

CityBikes = function () {
	CityBikes.super_.call(this);

	this._isReady = false;
	this._cachedNetworks = null;
	this._cacheExpirationTime = new Date();
	this._networkCacheStatus = states.empty;
	
	this._networksCacheTime = 30 * 60000;
	this._stationCacheTime = 1 * 60000;

	// A dictionary of timezones matched to cities.
	this._networkTimezones = {};
	this._networksAwaitingTimezone = {};
	
	this.loadCacheOnStart = true;//process.env.VCAP_APP_PORT;
	
	this.__esribikeshare = new esribikeshare.EsriBikeshare();

	if (fs.existsSync(timezoneCacheFilename))
	{
		// Load a timezones file. Otherwise we'll be forced to create one from hits against
		// the timezonedb API.
		this._networkTimezones = JSON.parse(fs.readFileSync(timezoneCacheFilename, 'utf8'));
		console.log("Loaded timezones from " + timezoneCacheFilename);
	}

	// Someone created an instance of us. Let's get our caches built.
// 	var citybikesProvider = this;
	this._networks(function(networkList, err) {
		if (err) {
			console.log("Error caching networks! " + err);
		} else {
			this._cachedNetworks = networkList;
			this._isReady = true;
		}
	}.bind(this));
};

// This node.js helper function allows us to inherit from dataproviderbase.
util.inherits(CityBikes, dataproviderbase.DataProviderBase);


/// CityBik.es specific code.
Object.defineProperties(CityBikes.prototype, {
	_cacheInvalid: {
		value: function(provider) {
			// Convenience function to check whether we need to refresh our Networks data.
			var now = new Date();
			var cacheInvalid = (provider._cachedNetworks == null) || (now >= provider._cacheExpirationTime);
			return cacheInvalid;
		}
	},
	_cacheNetworks: {
		value: function(networksJSON, callback) {
			// Finished eating our HTTP response.
			console.log("Caching Networks...");
			var added = 0;

			// JSON from the CityBik.es API.
			var networks = JSON.parse(networksJSON);
			// A blank cache
			var nc = {};
			
			networks.push(this.__esribikeshare.network);

			// update cache
			for (var i=0; i<networks.length; i++)
			{
				var network = networks[i];
				if (!(network.name in nc))
				{
					// No entry in the cache for this network.
					// 1. Fix the "lat" and "lng" that we get back.
					network.lat = network.lat / 1000000;
					network.lng = network.lng / 1000000;
					var x = network.lng;
					var y = network.lat;
					// Build an extent based off this lat/lng for the FeatureService
					network["calculatedExtent"] = {
						xmin: x - (extentMinWidth/2),
						xmax: x + (extentMinWidth/2),
						ymin: y - (extentMinHeight/2),
						ymax: y + (extentMinHeight/2),
						spatialReference: {
							"wkid": 4326,
							"latestWkid": 4326
						}
					};

					// Create a new cache entry based off this...
					var networkCacheEntry = {
						"network": network, 
						"stations": { 
								lastReadTime: -1,
								cacheExpirationTime: new Date(),
								cachedStations: [],
								status: states.empty
							},
						"timezone": null
					};
			
					// And store it in the cache
					nc[network.name] = networkCacheEntry;
		
					// Set up the timezone for this network
					this._getTimezone(networkCacheEntry, (function() {
						if (this.loadCacheOnStart) {
							// Don't pre-cache unless deployed
							console.log("Precaching stations for " + networkCacheEntry.network.name);
							this._stationsForNetwork(networkCacheEntry, null, function(stations) {
								return null;
							});
						}
					}).bind(this));
		
					added++
				}
			}

			// Mark the networks cache as valid for the next little while.
			this._cacheExpirationTime = new Date();
			this._cacheExpirationTime.setTime(this._cacheExpirationTime.getTime() + this._networksCacheTime);
			console.log("Cached " + added + " new networks!");
			console.log("Networks cache expires at: " + this._cacheExpirationTime);

			// And callback with the networks cache.
			this._networkCacheStatus = states.loaded;
			callback(nc, null);
		}
	},
	_networks: {
		value: function(callback) {
			if (this._cacheInvalid(this))
			{
				console.log(this._networkCacheStatus);
				if (this._networkCacheStatus !== states.loading) {
					this._networkCacheStatus = states.loading;
					// Load the latest list of bike share networks
					console.log("Requesting Networks...");
					http.get(cityBikesNetworksURL, (function(res)
					{
						res.setEncoding('utf8');
						var networksJSON = "";

						res.on('data', function(chunk) {
							networksJSON = networksJSON + chunk;
						});

						res.on('end', (function() 
						{
							this._cacheNetworks(networksJSON, callback);
						}).bind(this));
					}).bind(this));
				} else {
					console.log("Waiting for networks cache");
					// Cache is still loading.
					((function waitForCache(cb) {
						var provider = this;
						setTimeout(function () {
							if (this._networkCacheStatus !== states.loaded) {
								// We weren't ready yet, let's try again in a few
								waitForCache(cb);
							} else {
								console.log("Networks Cached. Done waiting!");
								cb(provider._cachedNetworks, null);
							}
						}, 100);
					}).bind(this))(callback);
				}
			}
			else
			{
				// Simple. Just return the cached networks.
				callback(this._cachedNetworks, null);
			}
		}
	},
	_getGMTOffsetString: {
		value: function(timezone) {
			// Build a string suitable to append to a Date/Time string
			// to specify offset from GMT.
			var offsetSeconds = timezone.gmtOffset,
				offsetMinutes = Math.round(Math.abs(offsetSeconds)/60),
				offsetMinRem = offsetMinutes%60,
				offsetHours = (offsetMinutes-offsetMinRem)/60,
				gmtOffStr = offsetSeconds<0?"-":"+";
			gmtOffStr += offsetHours==0?"00":((offsetHours<10?"0":"") + offsetHours);
			gmtOffStr += offsetMinRem==0?"00":((offsetMinRem<10?"0":"") + offsetMinRem);
			return gmtOffStr;
		}
	},
	_networkFeatures: {
		value: function(networks, callback) {
			var results = [];
			var networksToLoad = Object.keys(networks).length;
			for (var networkName in networks) {
				var n = networks[networkName];
				var nData = n.network;
				var svcUrl = this.baseUrl + this.urls.getLayerUrl(networkName, 0);

				var networkFeature = {
					geometry: {
						x: nData.lng,
						y: nData.lat,
						spatialReference: {
							wkid: 4326
						}
					},
					attributes: {
						id: nData.id,
						name: nData.name,
						apiurl: nData.url,
						url: svcUrl,
						agolmap: util.format(newMapTemplate, svcUrl),
						stations: n.stations.cachedStations.length,
						docks: 0,
						bikes: 0,
						citybikesTimeString: "",
						utcTime: n.stations.lastReadTime,
						timezone: n.timezone.abbreviation,
						timezoneOffset: +(n.timezone.gmtOffset),
						timezoneOffsetString: this._getGMTOffsetString(n.timezone),
						localTimeString: ""
					}
				};
				
				results.push(networkFeature);

				this._stationsForNetwork(n, 5*60*1000, (function(stationFeatures, err) {
					if (err) { 
						console.log("Couldn't read stations for network " + this.name);
						this.docks = this.bikes = -1;
					} else {
						for (var i=0; i<stationFeatures.length; i++) {
							this.docks += stationFeatures[i].attributes.free;
							this.bikes += stationFeatures[i].attributes.bikes;
						}
						this.docks = Math.max(0,this.docks);
					}

					networksToLoad--;
					if (networksToLoad == 0) {
						callback(results, null);
					}
				}).bind(networkFeature.attributes));
			}
		}
	},
	_stationsForNetwork: {
		value: function(n, cacheExtendedValidityDuration, callback) {
			// Given a networkCacheEntry (see this._networks and this._cachedNetworks),
			// give me the latest information on all the stations. Note, the cached stations
			// for a network are valid for 60 seconds.
			var cacheValid = false;
			if (n.stations.lastReadTime != -1) {
				cacheValid = n.stations.cacheExpirationTime > new Date();
				if (!cacheValid && typeof cacheExtendedValidityDuration !== null) {
					cacheValid = ((new Date()) - n.stations.lastReadTime) < cacheExtendedValidityDuration;
				}
			}
			if (cacheValid) {
				// Easy, we already have the info cached.
				console.log("Returning cached station results for " + n.network.name);
				callback(n.stations.cachedStations, null);
			} else {
				if (n.stations.status !== states.loading) {
					console.log("Loading stations for " + n.network.name);
					n.stations.status = states.loading;
					// OK, we need to go and ask api.citybik.es for the info.
					// Note, we can only ask for the current state of ALL stations in a given network.
					if (n.network.name === this.__esribikeshare.name) {
						this._cacheStations(n, this.__esribikeshare.stations, callback);
					} else {
						var cityBikesUrl = n.network.url;
						http.get(cityBikesUrl, (function (res)
						{
							res.setEncoding('utf8');
							var stationsJSON = "";
			
							res.on('data', function(chunk) {
								stationsJSON = stationsJSON + chunk;
							});

							res.on('end', (function() 
							{
								// Done eating the stations HTTP response for a given network.
								var stationsData = JSON.parse(stationsJSON);

								this._cacheStations(n, stationsData, callback);
							}).bind(this));
						}).bind(this));
					}
				} else {
					console.log("Waiting for " + n.network.name + " stations cache");
					var nce = n;
					(function waitForStations(cb) {
						setTimeout(function () {
							if (nce.stations.status !== states.loaded) {
								// We weren't ready yet, let's try again in a few
								waitForStations(cb);
							} else {
								console.log("Stations Cached for " + nce.network.name + ". Done waiting!");
								cb(nce.stations.cachedStations, null);
							}
						}, 100);
					})(callback);
				}
			}
		}
	},
	_cacheStations: {
		value: function(n, stationsData, callback) {
			// Clear the cache.
			n.stations.cachedStations = [];
			// We'll build an accurate envelope of all stations for later.
			var minX = 0;
			var minY = 0;
			var maxX = 0;
			var maxY = 0;
			for (var i=0; i < stationsData.length; i++)
			{
				var station = stationsData[i];

				// Get the non-UTC timestamp returned by api.citybik.es					
				var tmp = new Date(station.timestamp);
				station["citybikesTimeString"] = station.timestamp;

				// The timestamps are CEST - fix by - 2 hours.
				tmp.setTime(tmp.getTime() - (2 * 60 * 60 * 1000));
				var epochMS = new Date(tmp).getTime();
				// Return the corrected time as a new attribute.
				station["utcTime"] = epochMS;

				// We'll also try to get a timestamp local to someone in the network.
				var localEpochMS = new Date(epochMS).getTime();

				// We're also going to try to give any client some info about how
				// to convert the UTC timestamp to something appropriate for the 
				// network itself, or to do time calculations.
				gmtOffStr = "";

				if (n.timezone)
				{
					var gmtOffset = parseInt(n.timezone.gmtOffset);
					localEpochMS = localEpochMS + (gmtOffset * 1000);
					gmtOffStr = this._getGMTOffsetString(n.timezone);
					station["timezone"] = n.timezone.abbreviation;
					station["timezoneOffset"] = parseInt(n.timezone.gmtOffset);
				}
				else
				{
					// We haven't been able to get timezone information for this
					// network so we must default to everything beting UTC (akaGMT).
					gmtOffStr += "+0000";
					station["timezone"] = "GMT";
					station["timezoneOffset"] = 0;
					console.log("Uh oh - no timezone for " + n.network.name);
				}
				station["timezoneOffsetString"] = "GMT" + gmtOffStr;
				station["localTimeString"] = new Date(localEpochMS).toUTCString() + gmtOffStr;

				// Fix the lat/lng					
				var x = station.lng / 1000000;
				var y = station.lat / 1000000;
				if (x < -180 || x > 180 || y < -90 || y > 90 || x == 0 || y == 0) {
					console.log("Invalid GeoLocation!! " + y + "," + x);
					console.log(station);
					x = n.network.lng;
					y = n.network.lat;
					console.log("Corrected GeoLocation!! " + y + "," + x);
				}
		
				// Now build that GeoService formatted feature that we need.
				var stationFeature = {
					geometry: {
						x: x,
						y: y,
						spatialReference: {
							wkid: 4326
						}
					},
					attributes: JSON.parse(JSON.stringify(station))
				};
			
				// Fix the bike data if need be.
				stationFeature.attributes.bikes = +stationFeature.attributes.bikes;
				stationFeature.attributes.free = +stationFeature.attributes.free;
		
				// Get that nice smart-value for AGOL rendering (see _getBikeRange()).
				this._getBikeRange(stationFeature);
				this._getDockRange(stationFeature);
				
				if (n.network.name === this.__esribikeshare.name) {
					this.__esribikeshare._getBikeRange(this, stationFeature);
					this.__esribikeshare._getDockRange(this, stationFeature);
				}
		
				// Remove some attributes we don't want to output.
				delete stationFeature.attributes["lat"];
				delete stationFeature.attributes["lng"];
				delete stationFeature.attributes["coordinates"];
				delete stationFeature.attributes["timestamp"];
		
				var includeFeature = true;
				if (featureFilterFunctions.hasOwnProperty(n.network.name)) {
					includeFeature = featureFilterFunctions[n.network.name](stationFeature);
				}
	
				if (includeFeature) {
					// And build that extent so that the "Layer (Feature Service)"
					// JSON can specify the extent of the layer. That way, when it's
					// added to a map, it can be zoomed to easily.
					if (n.stations.cachedStations.length == 0) {
						minX = x;
						maxX = x;
						minY = y;
						maxY = y;
					} else {
						if (x < minX) minX = x;
						if (x > maxX) maxX = x;
						if (y < minY) minY = y;
						if (y > maxY) maxY = y;
					}

					// And add the stations cache to our overall cache structure.
					n.stations.cachedStations.push(stationFeature);
				}
			}
			
			if (minX == maxX) {
				minX -= extentMinWidth/2;
				maxX += extentMinWidth/2;
			}
			if (minY == maxY) {
				minY -= extentMinHeight/2;
				maxY += extentMinHeight/2;
			}
			// Store the calculated extent
			n.stations["extent"] = n.network["calculatedExtent"] = {
				xmin: minX, ymin: minY,
				xmax: maxX, ymax: maxY,
				spatialReference: {
					"wkid": 4326,
					"latestWkid": 4326
				}
			};
			
			// Flag when we last parsed the stations for this network.
			n.stations.lastReadTime = new Date();

			// And mark when the cache will next be invalid.
			n.stations.cacheExpirationTime =
				new Date(n.stations.lastReadTime.getTime() + this._stationCacheTime);

			console.log(util.format('Cached %d stations for %s at %s (expires %s) %d bytes',
									stationsData.length, n.network.name,
									n.stations.lastReadTime,
									n.stations.cacheExpirationTime,
									JSON.stringify(n.stations).length));

			// Good. Call back with the results of our hard work.	
			n.stations.status = states.loaded;			
			callback(n.stations.cachedStations, null);
		}
	},
	_getTimezone: {
		value: function(networkCacheEntry, callback) {
			// We'll try to load some timezone information so that in addition to a UTC
			// timestamp describing when each station in a network was last udpated, we
			// can also give a client some information about displaying that time in a
			// suitable local format.
			//
			// This is an example of how we fix the underlying data on the fly (the timestamps
			// that are returned by Citybik.es are not UTC, but rather local time for the 
			// server, in Madrid) and also how we augment that information with data which
			// consumers of the service are likely to find useful (JavaScript handling of
			// timezone-specific calculations and formatting is pretty poor).
			var network = networkCacheEntry.network;
			var networkName = networkCacheEntry.network.name;
			if (this._networkTimezones.hasOwnProperty(networkName))
			{
				// Try to read the timezone information from a cache file.
				networkCacheEntry["timezone"] = this._networkTimezones[networkName];
				callback.call(this, networkCacheEntry);
			}
			else
			{
				// Try to load the timezone information from the timezonedb API. Note that this
				// is rate limited and it's pretty easy during development to hit the limit,
				// hence the use of the cache above.
				this._networksAwaitingTimezone[networkName] = true;
				var timezoneUrl = util.format("http://api.timezonedb.com/?key=%s&lat=%d&lng=%d&format=json", timezoneAPIKey, network.lat, network.lng);

				http.get(timezoneUrl, (function (res) 
				{
					var timezoneJSON = "";
					res.setEncoding('utf8');
					res.on('data', function(chunk) {
						timezoneJSON += chunk;
					});
					res.on('end', (function() 
					{
						var loadedTimezoneOK = false;
						var timezone = null;
						try
						{
							timezone = JSON.parse(timezoneJSON);
							loadedTimezoneOK = true;
						}
						catch (err)
						{
							console.log(err)
							console.log(timezoneJSON);
						}
				
						if (loadedTimezoneOK)
						{
							if (timezone.status === "OK")
							{
								delete timezone["status"];
								delete timezone["message"];
								// Mark this timezone information as valid for a day.
								timezone["cacheRefreshDue"] = (new Date()).getTime() + 24*60*60000;
								networkCacheEntry["timezone"] = timezone;

								// And associate it with whichever network asked for it.
								this._networkTimezones[networkName] = timezone;

								// Stop tracking that we're still looking for it.				
								delete this._networksAwaitingTimezone[networkName];
								console.log("Timezone: " + networkName + " (" + Object.size(this._networksAwaitingTimezone) + ")");
								console.log(timezone);
							
								// And if we're no longer looking for any timezones, save
								// the file in a cache so we don't hit our rate-limit on the
								// timezonedb API too soon.
								if (Object.size(this._networksAwaitingTimezone) == 0)
								{
									if (!fs.existsSync(path.dirname(timezoneCacheFilename))) {
										fs.mkDirSync(path.dirname(timezoneCacheFilename));
									}
									fs.writeFile(timezoneCacheFilename, JSON.stringify(this._networkTimezones));
									console.log("Wrote timezones to " + timezoneCacheFilename);
								}
							
								// Call back with our updated cache entry, setting "this"
								callback.call(this, networkCacheEntry);
							}
						}
					}).bind(this));
				}).bind(this));
			}
		}
	},
	// We add a field that gives some idea of the number of bikes available rather than
	// raw numbers - this is easier to render off for AGOL. Better maps FTW!
	_getClassValue: {
		value: function(classificationScheme, value) {
			var classes = [];
			for ( var k in classificationScheme ) {
				classes.push(k);
			}
		
			for ( var i=0; i<classes.length; i++ ) {
				var className = classes[i],
					classRange = classificationScheme[className],
					min = classRange.min,
					max = classRange.max;

				if ( value >= min && value <= max ) {
					return classRange.label;
				}
			}
		
			return value + " out of range!";
		}
	},
	_getBikeRange: {
		value: function(station) {
			var bikesAvailable = station.attributes.bikes;

			station.attributes["bikesClass"] = this._getClassValue(bikeClassificationScheme, bikesAvailable);
		}
	},
	_getDockRange: {
		value: function(station) {
			var docksFree = station.attributes.free;
		
			station.attributes["docksClass"] = this._getClassValue(dockClassificationScheme, docksFree);
		}
	}
});


// DataProvider Overrides (see src/dataproviderbase.js).
Object.defineProperties(CityBikes.prototype, {
	name: {
		get: function() {
			// Override the service name - every data provider should override this.
			return "citybikes";
		}
	},
	isReady: {
		get: function() {
			// Since we depend on some async stuff, we might not be ready immediately.
			// We'll track our readiness in the constructor and return whatever that says
			// is the case.
			return this._isReady;
		}
	},
	getServiceIds: {
		value: function(callback) {
			// Each Network (typically a city) is mapped to a FeatureService. We'll then
			// give each feature service a single layer, and that layer will contain the
			// actual bike stations information for that network. So, we use the network
			// name (the Citybik.es identifier) as the ServiceID.
			var out = [];
			if (this._isReady) {
				out.push(allNetworksServiceId);
				for (var networkName in this._cachedNetworks) {
					out.push(networkName);
				}
			}
			callback(out.sort());
		}
	},
	getLayerIds: {
		value: function(serviceId, callback) {
			if (serviceId === allNetworksServiceId) {
				callback([allNetworksAllDataLayerId, allNetworksGoodDataLayerId], null);
			} else {
				callback([0], null);
			}
		}
	},
	getServiceName: {
		value: function(serviceId) {
			return serviceId === allNetworksServiceId?allNetworksServiceName:serviceId;
		}
	},
	getLayerName: {
		value: function(serviceId, layerId) {
			if (serviceId===allNetworksServiceId) {
				switch (layerId) {
					case allNetworksAllDataLayerId:
						return allNetworksAllDataLayerName;
					case allNetworksGoodDataLayerId:
						return allNetworksGoodDataLayerName;
					default:
						return "Unknown Layer ID: " + layerId;
				}
			} else {
				return "Current Status";
			}
		}
	},
	idField: {
		value: function(serviceId, layerId) {
			return "id";
		}
	},
	nameField: {
		value: function(serviceId, layerId) {
			return "name";
		}
	},
	fields: {
		value: function(serviceId, layerId) {
			// These are the fields that the single layer of each FeatureService will return.
			// this could be different for each feature service and layer, but in the case
			// of Citybik.es the source schema does not change across networks so we just
			// use a constant schema for our FeatureLayers.
			return serviceId===allNetworksServiceId?networksFields:cityBikesFields;
		}
	},
	featuresForQuery: {
		value: function(serviceId, layerId, query, callback) {
			// Get the bike networks (which map to FeatyreServices). They may be cached,
			// or may need to be fetched. So they are returned with a callback.
			this._networks((function(networks, err) {
				if (err) { return callback(null, null, null, err); }
				
				var idField = this.idField(serviceId, layerId);
				var fields = this.fields(serviceId, layerId);
				
				if (serviceId === allNetworksServiceId) {
					this._networkFeatures(networks, function(results, err) {
						if (layerId == allNetworksGoodDataLayerId) {
							// Filter out 
							// Filter out Stations == 0
							results = results.filter(function (feature) {
								return feature.attributes.stations > 0;
							});
						}
						callback(results, idField, fields, err);
					});
				} else {
					// Now we have the full list of networks let's pick out the one we're 
					// after (which matches the "serviceId" and get all the bike stations in 
					// that network. Again, this may be cached, or may need to be got afresh.
					// Note that we know we only have a single layer (stations) for any
					// feature service (network) so we ignore the layerId.
					var network = networks[serviceId];
					this._stationsForNetwork(network, null, (function(stationFeatures, err) {
						// We have the stations for the network. These are our features
						// that match the query. So call back to our caller with our results.
						callback(stationFeatures, idField, fields, err);
					}).bind(this));
				}
			}).bind(this));
		}
	},
	getFeatureServiceDetails: {
		value: function(detailsTemplate, serviceId, callback) {
			// We'll take the default JSON that the engine has calculated for us, but we'll
			// inject an extent if we have one stored so that clients can connect to us
			// more easily.
			if (this._cachedNetworks &&
				this._cachedNetworks.hasOwnProperty(serviceId)) {
				var network = this._cachedNetworks[serviceId].network;
				if (network.hasOwnProperty("calculatedExtent"))
				{
					detailsTemplate.initialExtent = network.calculatedExtent;
				}
			}

			this.getLayerIds(serviceId, (function(layerIds, err) {
				callback(layerIds, this.getLayerNamesForIds(serviceId, layerIds), err);
			}).bind(this));
		}
	},
	getFeatureServiceLayerDetails: {
		value: function(detailsTemplate, serviceId, layerId, callback) {
			if (serviceId === allNetworksServiceId) {
				callback({
					layerName: this.getLayerName(serviceId, layerId), 
					idField: this.idField(serviceId, layerId),
					nameField: this.nameField(serviceId, layerId),
					fields: this.fields(serviceId, layerId),
					geometryType: "esriGeometryPoint"
				}, null);
			} else {
				detailsTemplate["drawingInfo"] = drawingInfo;
				// We'll take the default JSON that the engine has calculated for us, but we'll
				// inject an extent if we have one stored so that clients can connect to us
				// more easily.
				if (this._cachedNetworks &&
					this._cachedNetworks.hasOwnProperty(serviceId)) {
					var network = this._cachedNetworks[serviceId].network;
					if (network.hasOwnProperty("calculatedExtent"))
					{
						// If we have an accurate extent based off cached station locations,
						// use that.
						detailsTemplate.extent = network.calculatedExtent;
					}
					else
					{
						// Otherwise, use the lat/lon of the network as returned by CityBik.es
						// and build an extent around that.
						var x = network.lng;
						var y = network.lat;
						var w = 0.25, h = 0.25;
						detailsTemplate.extent.xmin = x - w;
						detailsTemplate.extent.xmax = x + w;
						detailsTemplate.extent.ymin = y - h;
						detailsTemplate.extent.ymax = y + h;
					}
					callback({
						layerName: this.getLayerName(serviceId, layerId), 
						idField: this.idField(serviceId, layerId),
						nameField: this.nameField(serviceId, layerId),
						fields: this.fields(serviceId, layerId),
						geometryType: this.geometryType(serviceId, layerId)
					}, null);
				} else {
					callback({},
							 "Invalid CityBikes Service ID: " + serviceId);
				}
			}
		}
	}
});

// This allows node.js to import the right things when someone does a require() on us.
exports.CityBikes = CityBikes;
