/* eslint-disable max-lines */
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

/**
 * Das Modul besteht aus der Controller-Klasse für Lesen an der REST-Schnittstelle.
 * @packageDocumentation
 */

// eslint-disable-next-line max-classes-per-file
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    type Magazin,
    type MagazinArt,
    type Verlag,
} from '../entity/magazin.entity.js';
import {
    MagazinReadService,
    type Suchkriterien,
} from '../service/magazin-read.service.js';
// eslint-disable-next-line sort-imports
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    Param,
    Query,
    Req,
    Res,
    UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { getBaseUri } from './getBaseUri.js';
import { getLogger } from '../../logger/logger.js';

// TypeScript
interface Link {
    href: string;
}
interface Links {
    self: Link;
    // optional
    list?: Link;
    add?: Link;
    update?: Link;
    remove?: Link;
}

// Interface fuer GET-Request mit Links fuer HATEOAS
export type MagazinModel = Omit<
    Magazin,
    'aktualisiert' | 'erzeugt' | 'id' | 'schlagwoerter' | 'version'
> & {
    schlagwoerter: string[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _links: Links;
};

export interface MagazineModel {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _embedded: {
        magazine: MagazinModel[];
    };
}

/**
 * Klasse für `MagazinGetController`, um Queries in _OpenAPI_ bzw. Swagger zu
 * formulieren. `MagazinController` hat dieselben Properties wie die Basisklasse
 * `Magazin` - allerdings mit dem Unterschied, dass diese Properties beim Ableiten
 * so überschrieben sind, dass sie auch nicht gesetzt bzw. undefined sein
 * dürfen, damit die Queries flexibel formuliert werden können. Deshalb ist auch
 * immer der zusätzliche Typ undefined erforderlich.
 * Außerdem muss noch `string` statt `Date` verwendet werden, weil es in OpenAPI
 * den Typ Date nicht gibt.
 */
export class MagazinQuery implements Suchkriterien {
    @ApiProperty({ required: false })
    declare readonly titel: string;

    @ApiProperty({ required: false })
    declare readonly rating: number;

    @ApiProperty({ required: false })
    declare readonly art: MagazinArt;

    @ApiProperty({ required: false })
    declare readonly verlag: Verlag;

    @ApiProperty({ required: false })
    declare readonly preis: number;

    @ApiProperty({ required: false })
    declare readonly rabatt: number;

    @ApiProperty({ required: false })
    declare readonly lieferbar: boolean;

    @ApiProperty({ required: false })
    declare readonly datum: string;

    @ApiProperty({ required: false })
    declare readonly issn: string;

    @ApiProperty({ required: false })
    declare readonly homepage: string;

    @ApiProperty({ required: false })
    declare readonly javascript: boolean;

    @ApiProperty({ required: false })
    declare readonly typescript: boolean;
}

/**
 * Die Controller-Klasse für die Verwaltung von Bücher.
 */
// Decorator in TypeScript, zur Standardisierung in ES vorgeschlagen (stage 3)
// https://github.com/tc39/proposal-decorators
@Controller()
// @UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Magazin API')
// @ApiBearerAuth()
// Klassen ab ES 2015
export class MagazinGetController {
    // readonly in TypeScript, vgl. C#
    // private ab ES 2019
    readonly #service: MagazinReadService;

    readonly #logger = getLogger(MagazinGetController.name);

    // Dependency Injection (DI) bzw. Constructor Injection
    // constructor(private readonly service: MagazinReadService) {}
    constructor(service: MagazinReadService) {
        this.#service = service;
    }

    /**
     * Ein Magazin wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solches Magazin gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Magazines gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird das gefundene
     * Magazin im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es kein Magazin zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param id Pfad-Parameter `id`
     * @param req Request-Objekt von Express mit Pfadparameter, Query-String,
     *            Request-Header und Request-Body.
     * @param version Versionsnummer im Request-Header bei `If-None-Match`
     * @param accept Content-Type bzw. MIME-Type
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // vgl Kotlin: Schluesselwort "suspend"
    // eslint-disable-next-line max-params, max-lines-per-function
    @Get(':id')
    @ApiOperation({ summary: 'Suche mit der Magazin-ID', tags: ['Suchen'] })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 00000000-0000-0000-0000-000000000001',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Das Magazin wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Magazin zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Das Magazin wurde bereits heruntergeladen',
    })
    async findById(
        @Param('id') id: string,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<MagazinModel | undefined>> {
        this.#logger.debug('findById: id=%s, version=%s"', id, version);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('findById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        let magazin: Magazin | undefined;
        try {
            // vgl. Kotlin: Aufruf einer suspend-Function
            magazin = await this.#service.findById(id);
        } catch (err) {
            // err ist implizit vom Typ "unknown", d.h. keine Operationen koennen ausgefuehrt werden
            // Exception einer export async function bei der Ausfuehrung fangen:
            // https://strongloop.com/strongblog/comparing-node-js-promises-trycatch-zone-js-angular
            this.#logger.error('findById: error=%o', err);
            return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        if (magazin === undefined) {
            this.#logger.debug('findById: NOT_FOUND');
            return res.sendStatus(HttpStatus.NOT_FOUND);
        }
        this.#logger.debug('findById(): magazin=%o', magazin);

        // ETags
        const versionDb = magazin.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('findById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('findById: versionDb=%s', versionDb);
        res.header('ETag', `"${versionDb}"`);

        // HATEOAS mit Atom Links und HAL (= Hypertext Application Language)
        const magazinModel = this.#toModel(magazin, req);
        this.#logger.debug('findById: magazinModel=%o', magazinModel);
        return res.json(magazinModel);
    }

    /**
     * Bücher werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * ein solches Magazin gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Büchern, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Magazin zu den Suchkriterien gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Bücher ermittelt.
     *
     * @param query Query-Parameter von Express.
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @ApiOperation({ summary: 'Suche mit Suchkriterien', tags: ['Suchen'] })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Büchern' })
    async find(
        @Query() query: MagazinQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<MagazineModel | undefined>> {
        this.#logger.debug('find: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('find: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const magazine = await this.#service.find(query);
        this.#logger.debug('find: %o', magazine);
        if (magazine.length === 0) {
            this.#logger.debug('find: NOT_FOUND');
            return res.sendStatus(HttpStatus.NOT_FOUND);
        }

        // HATEOAS: Atom Links je Magazin
        const magazineModel = magazine.map((magazin) =>
            this.#toModel(magazin, req, false),
        );
        this.#logger.debug('find: magazineModel=%o', magazineModel);

        const result: MagazineModel = {
            _embedded: { magazine: magazineModel },
        };
        return res.json(result).send();
    }

    #toModel(magazin: Magazin, req: Request, all = true) {
        const baseUri = getBaseUri(req);
        this.#logger.debug('#toModel: baseUri=%s', baseUri);
        const { id } = magazin;
        const schlagwoerter = magazin.schlagwoerter.map(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (schlagwort) => schlagwort.schlagwort!,
        );
        const links = all
            ? {
                  self: { href: `${baseUri}/${id}` },
                  list: { href: `${baseUri}` },
                  add: { href: `${baseUri}` },
                  update: { href: `${baseUri}/${id}` },
                  remove: { href: `${baseUri}/${id}` },
              }
            : { self: { href: `${baseUri}/${id}` } };

        this.#logger.debug('#toModel: magazin=%o, links=%o', magazin, links);
        /* eslint-disable unicorn/consistent-destructuring */
        const magazinModel: MagazinModel = {
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
            _links: links,
        };
        /* eslint-enable unicorn/consistent-destructuring */

        return magazinModel;
    }
}
/* eslint-enable max-lines */
