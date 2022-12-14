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

CREATE TABLE IF NOT EXISTS schlagwort (
    id         CHAR(36) NOT NULL PRIMARY KEY,
    magazin_id    CHAR(36) NOT NULL REFERENCES magazin,
    schlagwort VARCHAR(16) NOT NULL CHECK (schlagwort = 'JAVASCRIPT' OR schlagwort = 'TYPESCRIPT'),

    INDEX schlagwort_magazin_idx(magazin_id)
) TABLESPACE magazinspace ROW_FORMAT=COMPACT;
