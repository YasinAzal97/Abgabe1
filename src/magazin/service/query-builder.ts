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
 * Das Modul besteht aus der Klasse {@linkcode QueryBuilder}.
 * @packageDocumentation
 */

import { FindOptionsUtils, Repository, type SelectQueryBuilder } from 'typeorm';
import { Magazin } from '../entity/magazin.entity.js';
// eslint-disable-next-line sort-imports
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { getLogger } from '../../logger/logger.js';
import { typeOrmModuleOptions } from '../../config/db.js';

/**
 * Die Klasse `QueryBuilder` implementiert das Lesen für Bücher und greift
 * mit _TypeORM_ auf eine relationale DB zu.
 */
@Injectable()
export class QueryBuilder {
    readonly #magazinAlias = `${Magazin.name
        .charAt(0)
        .toLowerCase()}${Magazin.name.slice(1)}`;

    readonly #repo: Repository<Magazin>;

    readonly #logger = getLogger(QueryBuilder.name);

    constructor(@InjectRepository(Magazin) repo: Repository<Magazin>) {
        this.#repo = repo;
    }

    /**
     * Ein Magazin mit der ID suchen.
     * @param id ID des gesuchten Magazines
     * @returns QueryBuilder
     */
    buildId(id: string) {
        const queryBuilder = this.#repo.createQueryBuilder(this.#magazinAlias);
        // Option { eager: true } in der Entity-Klasse wird nur bei find-Methoden des Repositories beruecksichtigt
        // https://github.com/typeorm/typeorm/issues/8292#issuecomment-1036991980
        // https://github.com/typeorm/typeorm/issues/7142
        FindOptionsUtils.joinEagerRelations(
            queryBuilder,
            queryBuilder.alias,
            this.#repo.metadata,
        );

        queryBuilder.where(`${this.#magazinAlias}.id = :id`, { id: id }); // eslint-disable-line object-shorthand
        return queryBuilder;
    }

    /**
     * Bücher asynchron suchen.
     * @param suchkriterien JSON-Objekt mit Suchkriterien
     * @returns QueryBuilder
     */
    // eslint-disable-next-line max-lines-per-function
    build(suchkriterien: Record<string, any>) {
        this.#logger.debug('build: suchkriterien=%o', suchkriterien);

        let queryBuilder = this.#repo.createQueryBuilder(this.#magazinAlias);
        // Option { eager: true } in der Entity-Klasse wird nur bei find-Methoden des Repositories beruecksichtigt
        // https://github.com/typeorm/typeorm/issues/8292#issuecomment-1036991980
        // https://github.com/typeorm/typeorm/issues/7142
        FindOptionsUtils.joinEagerRelations(
            queryBuilder,
            queryBuilder.alias,
            this.#repo.metadata,
        );

        // z.B. { titel: 'a', rating: 5, javascript: true }
        // Rest Properties fuer anfaengliche WHERE-Klausel
        // type-coverage:ignore-next-line
        const { titel, issn, javascript, typescript, ...props } = suchkriterien;

        queryBuilder = this.#buildSchlagwoerter(
            queryBuilder,
            javascript, // eslint-disable-line @typescript-eslint/no-unsafe-argument
            typescript, // eslint-disable-line @typescript-eslint/no-unsafe-argument
        );

        let useWhere = true;

        // Titel in der Query: Teilstring des Titels und "case insensitive"
        // CAVEAT: MySQL hat keinen Vergleich mit "case insensitive"
        // type-coverage:ignore-next-line
        if (titel !== undefined && typeof titel === 'string') {
            const ilike =
                typeOrmModuleOptions.type === 'postgres' ? 'ilike' : 'like';
            queryBuilder = queryBuilder.where(
                `${this.#magazinAlias}.titel ${ilike} :titel`,
                { titel: `%${titel}%` },
            );
            useWhere = false;
        }

        // type-coverage:ignore-next-line
        if (issn !== undefined && typeof issn === 'string') {
            // "-" aus issn-Nummer entfernen, da diese nicht abgespeichert sind
            const issnOhne = issn.replaceAll('-', '');
            const param = {
                issn: issnOhne,
            };
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#magazinAlias}.issn = :issn`,
                      param,
                  )
                : queryBuilder.andWhere(
                      `${this.#magazinAlias}.issn = :issn`,
                      param,
                  );
        }

        // Restliche Properties als Key-Value-Paare: Vergleiche auf Gleichheit
        Object.keys(props).forEach((key) => {
            const param: Record<string, any> = {};
            param[key] = props[key]; // eslint-disable-line @typescript-eslint/no-unsafe-assignment, security/detect-object-injection
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#magazinAlias}.${key} = :${key}`,
                      param,
                  )
                : queryBuilder.andWhere(
                      `${this.#magazinAlias}.${key} = :${key}`,
                      param,
                  );
        });

        this.#logger.debug('build: sql=%s', queryBuilder.getSql());
        return queryBuilder;
    }

    #buildSchlagwoerter(
        queryBuilder: SelectQueryBuilder<Magazin>,
        javascript: string | undefined,
        typescript: string | undefined,
    ) {
        // Schlagwort JAVASCRIPT aus der 2. Tabelle
        if (javascript === 'true') {
            // https://typeorm.io/select-query-builder#inner-and-left-joins
            // eslint-disable-next-line no-param-reassign
            queryBuilder = queryBuilder.innerJoinAndSelect(
                `${this.#magazinAlias}.schlagwoerter`,
                'swJS',
                'swJS.schlagwort = :javascript',
                { javascript: 'JAVASCRIPT' },
            );
        }
        if (typescript === 'true') {
            // eslint-disable-next-line no-param-reassign
            queryBuilder = queryBuilder.innerJoinAndSelect(
                `${this.#magazinAlias}.schlagwoerter`,
                'swTS',
                'swTS.schlagwort = :typescript',
                { typescript: 'TYPESCRIPT' },
            );
        }
        return queryBuilder;
    }
}
