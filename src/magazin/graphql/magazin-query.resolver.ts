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
import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Magazin } from '../entity/magazin.entity.js';
import { MagazinReadService } from '../service/magazin-read.service.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { UseInterceptors } from '@nestjs/common';
import { UserInputError } from 'apollo-server-express';
import { getLogger } from '../../logger/logger.js';

export type MagazinDTO = Omit<
    Magazin,
    'aktualisiert' | 'erzeugt' | 'schlagwoerter'
> & { schlagwoerter: string[] };
export interface IdInput {
    id: string;
}

@Resolver()
@UseInterceptors(ResponseTimeInterceptor)
export class MagazinQueryResolver {
    readonly #service: MagazinReadService;

    readonly #logger = getLogger(MagazinQueryResolver.name);

    constructor(service: MagazinReadService) {
        this.#service = service;
    }

    @Query('magazin')
    async findById(@Args() id: IdInput) {
        const idStr = id.id;
        this.#logger.debug('findById: id=%s', idStr);

        const magazin = await this.#service.findById(idStr);
        if (magazin === undefined) {
            // UserInputError liefert Statuscode 200
            // Weitere Error-Klasse in apollo-server-errors:
            // SyntaxError, ValidationError, AuthenticationError, ForbiddenError,
            // PersistedQuery, PersistedQuery
            // https://www.apollographql.com/blog/graphql/error-handling/full-stack-error-handling-with-graphql-apollo
            throw new UserInputError(
                `Es wurde kein Magazin mit der ID ${idStr} gefunden.`,
            );
        }
        const magazinDTO = this.#toMagazinDTO(magazin);
        this.#logger.debug('findById: magazinDTO=%o', magazinDTO);
        return magazinDTO;
    }

    @Query('magazine')
    async find(@Args() titel: { titel: string } | undefined) {
        const titelStr = titel?.titel;
        this.#logger.debug('find: titel=%s', titelStr);
        const suchkriterium = titelStr === undefined ? {} : { titel: titelStr };
        const magazine = await this.#service.find(suchkriterium);
        if (magazine.length === 0) {
            // UserInputError liefert Statuscode 200
            throw new UserInputError('Es wurden keine Magazine gefunden.');
        }

        const magazineDTO = magazine.map((magazin) =>
            this.#toMagazinDTO(magazin),
        );
        this.#logger.debug('find: magazineDTO=%o', magazineDTO);
        return magazineDTO;
    }

    #toMagazinDTO(magazin: Magazin) {
        const schlagwoerter = magazin.schlagwoerter.map(
            (schlagwort) => schlagwort.schlagwort!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        );
        const magazinDTO: MagazinDTO = {
            id: magazin.id,
            version: magazin.version,
            titel: magazin.titel,
            rating: magazin.rating,
            art: magazin.art,
            verlag: magazin.verlag,
            preis: magazin.preis,
            rabatt: magazin.rabatt,
            lieferbar: magazin.lieferbar,
            datum: magazin.datum,
            issn: magazin.issn,
            homepage: magazin.homepage,
            schlagwoerter,
        };
        return magazinDTO;
    }
}
