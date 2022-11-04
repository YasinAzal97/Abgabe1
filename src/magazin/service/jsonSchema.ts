/*
 * Copyright (C) 2019 - present Juergen Zimmermann, Hochschule Karlsruhe
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { type GenericJsonSchema } from './GenericJsonSchema.js';

export const MAX_RATING = 5;

export const jsonSchema: GenericJsonSchema = {
    // naechstes Release: 2021-02-01
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://acme.com/magazin.json#',
    title: 'Magazin',
    description: 'Eigenschaften eines Magazines: Typen und Constraints',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            pattern:
                '^[\\dA-Fa-f]{8}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{12}$',
        },
        version: {
            type: 'number',
            minimum: 0,
        },
        titel: {
            type: 'string',
            pattern: '^\\w.*',
        },
        rating: {
            type: 'number',
            minimum: 0,
            maximum: MAX_RATING,
        },
        art: {
            type: 'string',
            enum: ['DRUCKAUSGABE', 'DIGITAL', ''],
        },
        verlag: {
            type: 'string',
            enum: ['B_VERLAG', 'A_VERLAG', ''],
        },
        preis: {
            type: 'number',
            minimum: 0,
        },
        rabatt: {
            type: 'number',
            exclusiveMinimum: 0,
            exclusiveMaximum: 1,
        },
        lieferbar: { type: 'boolean' },
        datum: { type: 'string', format: 'date' },
        issn: { type: 'string', format: 'issn' },
        homepage: { type: 'string', format: 'uri' },
        schlagwoerter: {
            type: 'array',
            items: { type: 'object' },
        },
        erzeugt: { type: ['string', 'null'] },
        aktualisiert: { type: ['string', 'null'] },
    },
    required: ['titel', 'verlag', 'preis', 'issn'],
    additionalProperties: false,
    errorMessage: {
        properties: {
            version: 'Die Versionsnummer muss mindestens 0 sein.',
            titel: 'Ein Magazintitel muss mit einem Magazinstaben, einer Ziffer oder _ beginnen.',
            rating: 'Eine Bewertung muss zwischen 0 und 5 liegen.',
            art: 'Die Art eines Magazines muss DIGITAL oder DRUCKAUSGABE sein.',
            verlag: 'Der Verlag eines Magazines muss A_VERLAG oder B_VERLAG sein.',
            preis: 'Der Preis darf nicht negativ sein.',
            rabatt: 'Der Rabatt muss ein Wert zwischen 0 und 1 sein.',
            lieferbar: '"lieferbar" muss auf true oder false gesetzt sein.',
            datum: 'Das Datum muss im Format yyyy-MM-dd sein.',
            issn: 'Die issn-Nummer ist nicht korrekt.',
            homepage: 'Die Homepage ist nicht korrekt.',
        },
    },
};
