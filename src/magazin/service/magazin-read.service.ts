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

/**
 * Das Modul besteht aus der Klasse {@linkcode MagazinReadService}.
 * @packageDocumentation
 */

import {
    Magazin,
    type MagazinArt,
    type Verlag,
} from '../entity/magazin.entity.js';
import { MagazinValidationService } from './magazin-validation.service.js';
// eslint-disable-next-line sort-imports
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { QueryBuilder } from './query-builder.js';
import { Repository } from 'typeorm';
import { getLogger } from '../../logger/logger.js';

export interface Suchkriterien {
    readonly titel?: string;
    readonly rating?: number;
    readonly art?: MagazinArt;
    readonly verlag?: Verlag;
    readonly preis?: number;
    readonly rabatt?: number;
    readonly lieferbar?: boolean;
    readonly datum?: string;
    readonly issn?: string;
    readonly homepage?: string;
    readonly javascript?: boolean;
    readonly typescript?: boolean;
}

/**
 * Die Klasse `MagazinReadService` implementiert das Lesen für Bücher und greift
 * mit _TypeORM_ auf eine relationale DB zu.
 */
@Injectable()
export class MagazinReadService {
    readonly #repo: Repository<Magazin>;

    readonly #magazinProps: string[];

    readonly #queryBuilder: QueryBuilder;

    readonly #validationService: MagazinValidationService;

    readonly #logger = getLogger(MagazinReadService.name);

    constructor(
        @InjectRepository(Magazin) repo: Repository<Magazin>,
        queryBuilder: QueryBuilder,
        validationService: MagazinValidationService,
    ) {
        this.#repo = repo;
        const magazinDummy = new Magazin();
        this.#magazinProps = Object.getOwnPropertyNames(magazinDummy);
        this.#queryBuilder = queryBuilder;
        this.#validationService = validationService;
    }

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C# und Mono<> aus Project Reactor
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Magazin asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Magazines
     * @returns Das gefundene Magazin vom Typ [Magazin](magazin_entity_magazin_entity.Magazin.html) oder undefined
     *          in einem Promise aus ES2015 (vgl.: Mono aus Project Reactor oder
     *          Future aus Java)
     */
    async findById(id: string) {
        this.#logger.debug('findById: id=%s', id);

        if (!this.#validationService.validateId(id)) {
            this.#logger.debug('findById: Ungueltige ID');
            return;
        }

        // https://typeorm.io/working-with-repository
        // Das Resultat ist undefined, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        const magazin: Magazin | null = await this.#queryBuilder
            .buildId(id)
            .getOne();
        if (magazin === null) {
            this.#logger.debug('findById: Kein Magazin gefunden');
            return;
        }

        this.#logger.debug('findById: magazin=%o', magazin);
        return magazin;
    }

    /**
     * Bücher asynchron suchen.
     * @param suchkriterien JSON-Objekt mit Suchkriterien
     * @returns Ein JSON-Array mit den gefundenen Büchern. Ggf. ist das Array leer.
     */
    async find(suchkriterien?: Suchkriterien) {
        this.#logger.debug('find: suchkriterien=%o', suchkriterien);

        // Keine Suchkriterien?
        if (suchkriterien === undefined) {
            return this.#findAll();
        }
        const keys = Object.keys(suchkriterien);
        if (keys.length === 0) {
            return this.#findAll();
        }

        // Falsche Namen fuer Suchkriterien?
        if (!this.#checkKeys(keys)) {
            return [];
        }

        // QueryBuilder https://typeorm.io/select-query-builder
        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const magazine = await this.#queryBuilder
            .build(suchkriterien)
            .getMany();
        this.#logger.debug('find: magazine=%o', magazine);

        return magazine;
    }

    async #findAll() {
        const magazine = await this.#repo.find();
        this.#logger.debug('#findAll: alle magazine=%o', magazine);
        return magazine;
    }

    #checkKeys(keys: string[]) {
        // Ist jedes Suchkriterium auch eine Property von Magazin oder "schlagwoerter"?
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !this.#magazinProps.includes(key) &&
                key !== 'javascript' &&
                key !== 'typescript'
            ) {
                this.#logger.debug(
                    '#find: ungueltiges Suchkriterium "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }
}
