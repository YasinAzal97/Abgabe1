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
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { type CreateError, type UpdateError } from '../service/errors.js';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { type Magazin } from '../entity/magazin.entity.js';
import { MagazinWriteService } from '../service/magazin-write.service.js';
// eslint-disable-next-line sort-imports
import { type IdInput } from './magazin-query.resolver.js';
import { JwtAuthGraphQlGuard } from '../../security/auth/jwt/jwt-auth-graphql.guard.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { Roles } from '../../security/auth/roles/roles.decorator.js';
import { RolesGraphQlGuard } from '../../security/auth/roles/roles-graphql.guard.js';
import { type Schlagwort } from '../entity/schlagwort.entity.js';
import { UserInputError } from 'apollo-server-express';
import { getLogger } from '../../logger/logger.js';

type MagazinCreateDTO = Omit<
    Magazin,
    'aktualisiert' | 'erzeugt' | 'id' | 'schlagwoerter' | 'version'
> & { schlagwoerter: string[] };
type MagazinUpdateDTO = Omit<
    Magazin,
    'aktualisiert' | 'erzeugt' | 'schlagwoerter'
>;

// Authentifizierung und Autorisierung durch
//  GraphQL Shield
//      https://www.graphql-shield.com
//      https://github.com/maticzav/graphql-shield
//      https://github.com/nestjs/graphql/issues/92
//      https://github.com/maticzav/graphql-shield/issues/213
//  GraphQL AuthZ
//      https://github.com/AstrumU/graphql-authz
//      https://www.the-guild.dev/blog/graphql-authz

@Resolver()
// alternativ: globale Aktivierung der Guards https://docs.nestjs.com/security/authorization#basic-rbac-implementation
@UseGuards(JwtAuthGraphQlGuard, RolesGraphQlGuard)
@UseInterceptors(ResponseTimeInterceptor)
export class MagazinMutationResolver {
    readonly #service: MagazinWriteService;

    readonly #logger = getLogger(MagazinMutationResolver.name);

    constructor(service: MagazinWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'mitarbeiter')
    async create(@Args('input') magazinDTO: MagazinCreateDTO) {
        this.#logger.debug('create: magazinDTO=%o', magazinDTO);

        const result = await this.#service.create(
            this.#dtoToMagazin(magazinDTO),
        );
        this.#logger.debug('createMagazin: result=%o', result);

        if (Object.prototype.hasOwnProperty.call(result, 'type')) {
            // UserInputError liefert Statuscode 200
            throw new UserInputError(
                this.#errorMsgCreateMagazin(result as CreateError),
            );
        }
        return result;
    }

    @Mutation()
    @Roles('admin', 'mitarbeiter')
    async update(@Args('input') magazin: MagazinUpdateDTO) {
        this.#logger.debug('update: magazin=%o', magazin);
        const versionStr = `"${magazin.version?.toString()}"`;

        const result = await this.#service.update(
            magazin.id,
            magazin as Magazin,
            versionStr,
        );
        if (typeof result === 'object') {
            throw new UserInputError(this.#errorMsgUpdateMagazin(result));
        }
        this.#logger.debug('updateMagazin: result=%d', result);
        return result;
    }

    @Mutation()
    @Roles('admin')
    async delete(@Args() id: IdInput) {
        const idStr = id.id;
        this.#logger.debug('delete: id=%s', idStr);
        const result = await this.#service.delete(idStr);
        this.#logger.debug('deleteMagazin: result=%s', result);
        return result;
    }

    #dtoToMagazin(magazinDTO: MagazinCreateDTO): Magazin {
        const magazin: Magazin = {
            id: undefined,
            version: undefined,
            titel: magazinDTO.titel,
            rating: magazinDTO.rating,
            art: magazinDTO.art,
            verlag: magazinDTO.verlag,
            preis: magazinDTO.preis,
            rabatt: magazinDTO.rabatt,
            lieferbar: magazinDTO.lieferbar,
            datum: magazinDTO.datum,
            issn: magazinDTO.issn,
            homepage: magazinDTO.homepage,
            schlagwoerter: [],
            erzeugt: undefined,
            aktualisiert: undefined,
        };

        magazinDTO.schlagwoerter.forEach((s) => {
            const schlagwort: Schlagwort = {
                id: undefined,
                schlagwort: s,
                magazin,
            };
            magazin.schlagwoerter.push(schlagwort);
        });

        return magazin;
    }

    #errorMsgCreateMagazin(err: CreateError) {
        switch (err.type) {
            case 'ConstraintViolations': {
                return err.messages.join(' ');
            }
            case 'TitelExists': {
                return `Der Titel "${err.titel}" existiert bereits`;
            }
            case 'issnExists': {
                return `Die issn ${err.issn} existiert bereits`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }

    #errorMsgUpdateMagazin(err: UpdateError) {
        switch (err.type) {
            case 'ConstraintViolations': {
                return err.messages.join(' ');
            }
            case 'TitelExists': {
                return `Der Titel "${err.titel}" existiert bereits`;
            }
            case 'MagazinNotExists': {
                return `Es gibt kein Magazin mit der ID ${err.id}`;
            }
            case 'VersionInvalid': {
                return `"${err.version}" ist keine gueltige Versionsnummer`;
            }
            case 'VersionOutdated': {
                return `Die Versionsnummer "${err.version}" ist nicht mehr aktuell`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }
}
