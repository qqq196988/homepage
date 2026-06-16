***Overview***

This dataset provides long-term suspended sediment concentration (SSC, mg/L) data for 4,331 river reaches across the pan-Arctic region. It includes both vector river reach information and tabular SSC time series from 1984 to 2023. The dataset can be used for hydrological, geomorphological, and climate-related research.

The dataset consists of two files:

1. River reach SSC.xlsx
2. river_reaches_with_SSC.zip
--------------------------------------------------------------------

***File Descriptions***

1. River reach SSC.xlsx

==Format: Excel (.xlsx)
==Content: Time series of SSC for each river reach
==Rows: 4,331 river reaches (identified by ID)

2. river_reaches_with_SSC.zip

==Format: Compressed shapefile (.zip)
==Content: Vector river reaches with associated attributes
==Key Attributes:

ID — unique identifier for each river reach, matching the ID column in River reach SSC.xlsx
width_mean — average river width (meters)
basin_name — name of the basin/river system
basin_cont — continent of the river segment (NA = North America, EU = Eurasia)
--------------------------------------------------------------------

***Usage***

Linking SSC data to river reaches:
The ID column provides a unique key to join the time series (River reach SSC.xlsx) with the vector shapefile (river_reaches_with_SSC.shp).

Spatial analyses:
Load river_reaches_with_SSC.shp in GIS software (e.g., QGIS, ArcGIS) or Python (geopandas) to visualize river segments and their attributes.

Temporal analyses:
Use River reach SSC.xlsx to analyze SSC trends over 1984–2023. Combine with river attributes for flux calculations, regional comparison, or modeling.
--------------------------------------------------------------------

***Notes***

All river reaches in the shapefile have corresponding SSC records in the Excel file.

Ensure the ID column is used to correctly match SSC data with vector data.

The dataset focuses on major Arctic and Northern Hemisphere rivers.