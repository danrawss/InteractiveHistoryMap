// main.js

// Initialize global variables
var map;
var historicalFacts = {};
var geojsonLayer;
var userMarker;

// Function to initialize the map
function initMap() {
    // Define the maximum bounds for the map
    var southWest = L.latLng(-85, -180);
    var northEast = L.latLng(85, 180);
    var bounds = L.latLngBounds(southWest, northEast);

    // Initialize the map with custom options
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        worldCopyJump: false,
    });

    // Set minimum and maximum zoom levels
    map.setMinZoom(2);
    map.setMaxZoom(18);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        noWrap: true
    }).addTo(map);

    // Load GeoJSON data for country boundaries and historical facts
    Promise.all([
        fetch('data/countries.geojson').then(response => response.json()),
        fetch('data/historical_facts.json').then(response => response.json())
    ])
    .then(([geoData, historicalData]) => {
        historicalFacts = historicalData;

        // Add GeoJSON layer to the map with custom styling and events
        geojsonLayer = L.geoJSON(geoData, {
            style: defaultStyle,
            onEachFeature: onEachFeature
        }).addTo(map);

        // Get the bounds of the GeoJSON layer and set them as max bounds
        var geoJsonBounds = geojsonLayer.getBounds();
        map.setMaxBounds(geoJsonBounds.pad(0.1));
        map.fitBounds(geoJsonBounds);

        // Add event listener to the theme toggle button if it exists
        var toggleButton = document.getElementById('toggleTheme');
        if (toggleButton) {
            toggleButton.addEventListener('click', toggleTheme);
        }
    })
    .catch(error => {
        console.error('Error loading data:', error);
    });
}

// Define the default style for countries
var defaultStyle = {
    color: '#3388ff', // Border color
    weight: 1,
    fillColor: '#66ccff', // Fill color
    fillOpacity: 0.7
};

// Function to handle events on each feature
function onEachFeature(feature, layer) {
    const countryName = feature.properties.ADMIN;

    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: function(e) {
            showCountryInfo(countryName, e.latlng);
            drawCountryOnCanvas(feature);
        }
    });

    // Optional: Add tooltip on hover
    layer.bindTooltip(countryName, {
        permanent: false,
        direction: "auto"
    });
}

// Function to highlight feature on hover
function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle({
        weight: 2,
        color: '#666',
        fillColor: '#ffcc33',
        fillOpacity: 0.9
    });

    // Bring the layer to the front
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}

// Function to reset highlight on mouseout
function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
}

// Function to show country information with text-to-speech
function showCountryInfo(countryName, latlng) {
    var countryInfo = historicalFacts[countryName];
    if (countryInfo) {
        // Display information in a popup at the click location
        L.popup()
            .setLatLng(latlng)
            .setContent("<b>" + countryName + "</b><br>" + countryInfo.description)
            .openOn(map);

        // Use Web Speech API to speak the historical fact if supported
        if ('speechSynthesis' in window) {
            var msg = new SpeechSynthesisUtterance(countryInfo.description);
            window.speechSynthesis.speak(msg);
        } else {
            console.warn("Text-to-speech not supported in this browser.");
        }
    } else {
        // Handle case where no historical fact is available
        L.popup()
            .setLatLng(latlng)
            .setContent("<b>" + countryName + "</b><br>No historical facts available.")
            .openOn(map);
    }
}

// Function to draw the country's shape on the canvas using the Canvas API
function drawCountryOnCanvas(feature) {
    var canvas = document.getElementById('countryCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    var ctx = canvas.getContext('2d');

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up styles
    ctx.fillStyle = '#4285F4';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    var type = feature.geometry.type;
    var coordinates = feature.geometry.coordinates;

    // Handle different geometry types
    if (type === 'Polygon') {
        drawPolygon(ctx, coordinates);
    } else if (type === 'MultiPolygon') {
        coordinates.forEach(function(polygon) {
            drawPolygon(ctx, polygon);
        });
    } else {
        console.warn('Unsupported geometry type:', type);
    }
}

// Helper function to draw a polygon on the canvas
function drawPolygon(ctx, coordinates) {
    coordinates.forEach(function(ring) {
        ctx.beginPath();
        ring.forEach(function(coord, index) {
            var x = (coord[0] + 180) * (canvas.width / 360);
            var y = (90 - coord[1]) * (canvas.height / 180);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
}

// Geolocation: Locate user's current position
function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;

                // Set the map view to the user's location with a zoom level of 13
                map.setView([lat, lng], 13);

                // Remove existing user marker if it exists
                if (userMarker) {
                    map.removeLayer(userMarker);
                }

                // Define a custom pulsing icon using Leaflet's DivIcon
                var pulsingIcon = L.divIcon({
                    className: 'pulsing-icon'
                });

                // Add a marker with the custom icon at the user's location
                userMarker = L.marker([lat, lng], { icon: pulsingIcon })
                    .addTo(map)
                    .bindPopup("You are here")
                    .openPopup();
            },
            function(error) {
                console.error('Geolocation error:', error);
                alert("Unable to retrieve your location.");
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// Function to remove the user location marker
function removeUserMarker() {
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null; // Reset the variable
    } else {
        alert("No marker to remove.");
    }
}

// Initialize the map when the page loads
window.onload = function() {
    initMap();
};
