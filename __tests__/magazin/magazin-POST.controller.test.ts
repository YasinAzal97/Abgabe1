/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import { afterAll, beforeAll, describe, test } from '@jest/globals';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
    host,
    httpsAgent,
    port,
    shutdownServer,
    startServer,
} from '../testserver.js';
import { type MagazinDTO } from '../../src/magazin/rest/magazin-write.controller.js';
// eslint-disable-next-line sort-imports
import { HttpStatus } from '@nestjs/common';
import { ID_PATTERN } from '../../src/magazin/service/magazin-validation.service.js';
import { MAX_RATING } from '../../src/magazin/service/jsonSchema.js';
import { loginRest } from '../login.js';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuesMagazin: MagazinDTO = {
    titel: 'Testrest',
    rating: 1,
    art: 'DRUCKAUSGABE',
    verlag: 'A_VERLAG',
    preis: 99.99,
    rabatt: 0.099,
    lieferbar: true,
    datum: '2022-02-28',
    issn: '9780007006441',
    homepage: 'https://test.de/',
    schlagwoerter: ['JAVASCRIPT', 'TYPESCRIPT'],
};
const neuesMagazinInvalid: Record<string, unknown> = {
    titel: '!?$',
    rating: -1,
    art: 'UNSICHTBAR',
    verlag: 'NO_VERLAG',
    preis: 0,
    rabatt: 2,
    lieferbar: true,
    datum: '12345123123',
    issn: 'falsche-issn',
    schlagwoerter: [],
};
const neuesMagazinTitelExistiert: MagazinDTO = {
    titel: 'Alpha',
    rating: 1,
    art: 'DRUCKAUSGABE',
    verlag: 'A_VERLAG',
    preis: 99.99,
    rabatt: 0.099,
    lieferbar: true,
    datum: '2022-02-28',
    issn: '9780007097326',
    homepage: 'https://test.de/',
    schlagwoerter: ['JAVASCRIPT', 'TYPESCRIPT'],
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
// eslint-disable-next-line max-lines-per-function
describe('POST /', () => {
    let client: AxiosInstance;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
    };

    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        await startServer();
        const baseURL = `https://${host}:${port}`;
        client = axios.create({
            baseURL,
            httpsAgent,
            validateStatus: (status) => status < 500, // eslint-disable-line @typescript-eslint/no-magic-numbers
        });
    });

    // (done?: DoneFn) => Promise<void | undefined | unknown> | void | undefined
    // close(callback?: (err?: Error) => void): this
    afterAll(async () => {
        await shutdownServer();
    });

    test('Neues Magazin', async () => {
        // given
        const token = await loginRest(client);
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<string> = await client.post(
            '/',
            neuesMagazin,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.CREATED);

        const { location } = response.headers as { location: string };

        expect(location).toBeDefined();

        // ObjectID: Muster von HEX-Ziffern
        const indexLastSlash: number = location.lastIndexOf('/');

        expect(indexLastSlash).not.toBe(-1);

        const idStr = location.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        expect(ID_PATTERN.test(idStr)).toBe(true);

        expect(data).toBe('');
    });

    test('Neues Magazin mit ungueltigen Daten', async () => {
        // given
        const token = await loginRest(client);
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<string> = await client.post(
            '/',
            neuesMagazinInvalid,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(data).toEqual(
            expect.arrayContaining([
                'Ein Magazintitel muss mit einem Magazinstaben, einer Ziffer oder _ beginnen.',
                `Eine Bewertung muss zwischen 0 und ${MAX_RATING} liegen.`,
                'Die Art eines Magazines muss DIGITAL oder DRUCKAUSGABE sein.',
                'Der Verlag eines Magazines muss A_VERLAG oder B_VERLAG sein.',
                'Der Rabatt muss ein Wert zwischen 0 und 1 sein.',
                'Das Datum muss im Format yyyy-MM-dd sein.',
                'Die issn-Nummer ist nicht korrekt.',
            ]),
        );
    });

    test('Neues Magazin, aber der Titel existiert bereits', async () => {
        // given
        const token = await loginRest(client);
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<string> = await client.post(
            '/',
            neuesMagazinTitelExistiert,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(data).toEqual(expect.stringContaining('Titel'));
    });

    test('Neues Magazin, aber ohne Token', async () => {
        // when
        const response: AxiosResponse<Record<string, any>> = await client.post(
            '/',
            neuesMagazin,
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.FORBIDDEN);
        expect(data.statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    test('Neues Magazin, aber mit falschem Token', async () => {
        // given
        const token = 'FALSCH';
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<Record<string, any>> = await client.post(
            '/',
            neuesMagazin,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.FORBIDDEN);
        expect(data.statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    test.todo('Abgelaufener Token');
});
