/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-extra-non-null-assertion */
/*
 * Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import { type GraphQLRequest, type GraphQLResponse } from 'apollo-server-types';
import { afterAll, beforeAll, describe, test } from '@jest/globals';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
    host,
    httpsAgent,
    port,
    shutdownServer,
    startServer,
} from '../testserver.js';
import { type MagazinDTO } from '../../src/magazin/graphql/magazin-query.resolver.js';
// eslint-disable-next-line sort-imports
import { HttpStatus } from '@nestjs/common';
import each from 'jest-each';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const idVorhanden = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
];

const titelVorhanden = ['Alpha', 'Beta', 'Gamma'];

const teilTitelVorhanden = ['a', 't', 'g'];

const teilTitelNichtVorhanden = ['Xyz', 'abc'];

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
// eslint-disable-next-line max-lines-per-function
describe('GraphQL Queries', () => {
    let client: AxiosInstance;
    const graphqlPath = 'graphql';

    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        await startServer();
        const baseURL = `https://${host}:${port}/`;
        client = axios.create({
            baseURL,
            httpsAgent,
        });
    });

    afterAll(async () => {
        await shutdownServer();
    });

    each(idVorhanden).test(
        'Magazin zu vorhandener ID %s',
        async (id: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                {
                    magazin(id: "${id}") {
                        titel
                        art
                        issn
                        version
                    }
                }
            `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.errors).toBeUndefined();
            expect(data.data).toBeDefined();

            const { magazin } = data.data!;
            const result: MagazinDTO = magazin;

            expect(result.titel).toMatch(/^\w/u);
            expect(result.version).toBeGreaterThan(-1);
            expect(result.id).toBeUndefined();
        },
    );

    test('Magazin zu nicht-vorhandener ID', async () => {
        // given
        const id = '999999999999999999999999';
        const body: GraphQLRequest = {
            query: `
                {
                    magazin(id: "${id}") {
                        titel
                    }
                }
            `,
        };

        // when
        const response: AxiosResponse<GraphQLResponse> = await client.post(
            graphqlPath,
            body,
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data!.magazin).toBeNull();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { message, path, extensions } = error!;

        expect(message).toBe(
            `Es wurde kein Magazin mit der ID ${id} gefunden.`,
        );
        expect(path).toBeDefined();
        expect(path!![0]).toBe('magazin');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    each(titelVorhanden).test(
        'Magazin zu vorhandenem Titel %s',
        async (titel: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                    {
                        magazine(titel: "${titel}") {
                            titel
                            art
                        }
                    }
                `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.errors).toBeUndefined();

            expect(data.data).toBeDefined();

            const { magazine } = data.data!;

            expect(magazine).not.toHaveLength(0);

            const magazineArray: MagazinDTO[] = magazine;

            expect(magazineArray).toHaveLength(1);

            const [magazin] = magazineArray;

            expect(magazin!.titel).toBe(titel);
        },
    );

    each(teilTitelVorhanden).test(
        'Magazin zu vorhandenem Teil-Titel %s',
        async (teilTitel: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                    {
                        magazine(titel: "${teilTitel}") {
                            titel
                            art
                        }
                    }
                `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.errors).toBeUndefined();
            expect(data.data).toBeDefined();

            const { magazine } = data.data!;

            expect(magazine).not.toHaveLength(0);

            const magazineArray: MagazinDTO[] = magazine;
            magazineArray
                .map((magazin) => magazin.titel)
                .forEach((titel: string) =>
                    expect(titel.toLowerCase()).toEqual(
                        expect.stringContaining(teilTitel),
                    ),
                );
        },
    );

    each(teilTitelNichtVorhanden).test(
        'Magazin zu nicht vorhandenem Titel %s',
        async (teilTitel: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                    {
                        magazine(titel: "${teilTitel}") {
                            titel
                            art
                        }
                    }
                `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.data!.magazine).toBeNull();

            const { errors } = data;

            expect(errors).toHaveLength(1);

            const [error] = errors!;
            const { message, path, extensions } = error!;

            expect(message).toBe('Es wurden keine Magazine gefunden.');
            expect(path).toBeDefined();
            expect(path!![0]).toBe('magazine');
            expect(extensions).toBeDefined();
            expect(extensions!.code).toBe('BAD_USER_INPUT');
        },
    );
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-extra-non-null-assertion */
