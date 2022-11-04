-- Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- docker compose exec postgres bash
-- psql --dbname=magazin --username=magazin --file=/scripts/create-table-magazin.sql

-- https://www.postgresql.org/docs/devel/app-psql.html
-- https://www.postgresql.org/docs/current/ddl-schemas.html
-- https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-CREATE
-- "user-private schema" (Default-Schema: public)
CREATE SCHEMA IF NOT EXISTS AUTHORIZATION magazin;

ALTER ROLE magazin SET search_path = 'magazin';

-- https://www.postgresql.org/docs/current/sql-createtable.html
-- https://www.postgresql.org/docs/current/datatype.html
CREATE TABLE IF NOT EXISTS magazin (
                  -- https://www.postgresql.org/docs/current/datatype-uuid.html
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS
                  -- impliziter Index fuer Primary Key
                  -- TypeORM unterstuetzt nicht BINARY(16) fuer UUID
    id            char(36) PRIMARY KEY USING INDEX TABLESPACE magazinspace,
                  -- https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
    version       integer NOT NULL DEFAULT 0,
                  -- impliziter Index als B-Baum durch UNIQUE
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS
    titel         varchar(40) NOT NULL UNIQUE USING INDEX TABLESPACE magazinspace,
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#id-1.5.4.6.6
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS
    rating        integer NOT NULL CHECK (rating >= 0 AND rating <= 5),
                  -- https://www.postgresql.org/docs/current/functions-matching.html#FUNCTIONS-POSIX-REGEXP
    art           varchar(12) NOT NULL CHECK (art ~ 'DRUCKAUSGABE|DIGITAL'),
    verlag        varchar(12) NOT NULL CHECK (verlag ~ 'A_VERLAG|B_VERLAG'),
                  -- https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-NUMERIC-DECIMAL
                  -- 10 Stellen, davon 2 Nachkommastellen
    preis         decimal(8,2) NOT NULL,
    rabatt        decimal(4,3) NOT NULL,
                  -- https://www.postgresql.org/docs/current/datatype-boolean.html
    lieferbar     boolean NOT NULL DEFAULT FALSE,
                  -- https://www.postgresql.org/docs/current/datatype-datetime.html
    datum         date,
    homepage      varchar(40),
    issn          varchar(16) NOT NULL UNIQUE USING INDEX TABLESPACE magazinspace,
                  -- https://www.postgresql.org/docs/current/datatype-datetime.html
    erzeugt       timestamp NOT NULL DEFAULT NOW(),
    aktualisiert  timestamp NOT NULL DEFAULT NOW()
) TABLESPACE magazinspace;

CREATE TABLE IF NOT EXISTS schlagwort (
    id         char(36) PRIMARY KEY USING INDEX TABLESPACE magazinspace,
    magazin_id    char(36) NOT NULL REFERENCES magazin,
    schlagwort varchar(16) NOT NULL CHECK (schlagwort ~ 'JAVASCRIPT|TYPESCRIPT')
) TABLESPACE magazinspace;

-- default: btree
CREATE INDEX IF NOT EXISTS schlagwort_magazin_idx ON schlagwort(magazin_id) TABLESPACE magazinspace;
