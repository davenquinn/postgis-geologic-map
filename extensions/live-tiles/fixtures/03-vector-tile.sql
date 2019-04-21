-- https://www.zimmi.cz/posts/2017/postgis-as-a-mapbox-vector-tiles-generator/
CREATE OR REPLACE FUNCTION
tiles.createVectorTile(coord tile_coord)
RETURNS bytea
AS $$
DECLARE
srid integer;
mercator_bbox geometry;
projected_bbox geometry;
bedrock bytea;
surface bytea;
contact bytea;
zres float;
BEGIN

SELECT ST_SRID(geometry)
INTO srid
FROM map_topology.face_display
LIMIT 1;

mercator_bbox := TileBBox(coord.z, coord.x, coord.y, 3857);
projected_bbox := ST_Transform(mercator_bbox, srid);

zres := ZRes(coord.z)/2;

SELECT
  ST_AsMVT(a, 'bedrock', 4096, 'geom')
INTO bedrock
FROM (
  SELECT
    id,
    unit_id,
    ST_AsMVTGeom(
      ST_Simplify(
        ST_Transform(geometry, 3857),
        zres/2
      ),
      mercator_bbox
    ) geom
  FROM map_topology.face_display
  WHERE ST_Intersects(geometry, projected_bbox)
    AND topology = 'bedrock'
) a;

SELECT
  ST_AsMVT(a, 'surficial', 4096, 'geom')
INTO surface
FROM (
  SELECT
    id,
    unit_id,
    ST_AsMVTGeom(
      ST_Simplify(
        ST_Transform(geometry, 3857),
        zres/2
      ),
      mercator_bbox
    ) geom
  FROM map_topology.face_display
  WHERE ST_Intersects(geometry, projected_bbox)
    AND topology = 'surficial'
    AND unit_id != 'surficial-none'
) a;

SELECT
  ST_AsMVT(a, 'contact', 4096, 'geom')
INTO contact
FROM (
SELECT
  e.edge_id,
  er.line_id,
  er.type,
  ST_AsMVTGeom(
    ST_Simplify(
      ST_Transform(e.geom, 3857),
      zres/2
    ),
    mercator_bbox
  ) geom,
  coalesce(uc.commonality, 6) commonality
FROM map_topology.edge_data e
JOIN map_topology.__edge_relation er
  ON er.edge_id = e.edge_id
JOIN map_topology.face_type f1
  ON e.left_face = f1.face_id
 AND er.topology = f1.topology
JOIN map_topology.face_type f2
  ON e.right_face = f2.face_id
 AND er.topology = f2.topology
LEFT JOIN mapping.__unit_commonality uc
  ON uc.u1 = f1.unit_id
 AND uc.u2 = f2.unit_id
 AND uc.topology = er.topology
WHERE e.geom && TileBBox(10, 556, 583, 32733)
  AND er.type NOT IN (
    'arbitrary-bedrock',
    'arbitrary-surficial-contact'
)) a;

RETURN bedrock || surface || contact;

END;
$$
LANGUAGE plpgsql;
