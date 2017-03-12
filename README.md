# MapHubs Vector Tile Server

This is a light tile server that serves vector tiles from PostGIS with a file cache for performance. It builds Mapnik XML for a MapHubs layer and then gets tiles using tilelive-bridge (https://github.com/mapbox/tilelive-bridge).

This server automatically adds new layers and dynamically updates when layers change.

This code is based heavily on tilelive-tmsource (https://github.com/mojodna/tilelive-tmsource) and tessera (https://github.com/mojodna/tessera)

Note: this is only designed to work with a MapHubs database, but you are welcome to adapt it to work with other sources. For example, you could make a version that automatically detects tables in a PostGIS database.
