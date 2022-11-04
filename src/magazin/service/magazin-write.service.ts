/* eslint-disable max-lines */
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
 * Das Modul besteht aus der Klasse {@linkcode MagazinWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Magazin, removeissnDash } from '../entity/magazin.entity.js';
// eslint-disable-next-line sort-imports
import {
    type CreateError,
    type MagazinNotExists,
    type TitelExists,
    type UpdateError,
    type VersionInvalid,
    type VersionOutdated,
} from './errors.js';
import { type DeleteResult, Repository } from 'typeorm';
import { MagazinReadService } from './magazin-read.service.js';
import { MagazinValidationService } from './magazin-validation.service.js';
// eslint-disable-next-line sort-imports
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { MailService } from '../../mail/mail.service.js';
import RE2 from 're2';
import { Schlagwort } from '../entity/schlagwort.entity.js';
import { getLogger } from '../../logger/logger.js';
import { v4 as uuid } from 'uuid';

/**
 * Die Klasse `MagazinWriteService` implementiert den Anwendungskern für das
 * Schreiben von Bücher und greift mit _TypeORM_ auf die DB zu.
 */
@Injectable()
export class MagazinWriteService {
    private static readonly VERSION_PATTERN = new RE2('^"\\d*"');

    readonly #repo: Repository<Magazin>;

    readonly #readService: MagazinReadService;

    readonly #validationService: MagazinValidationService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(MagazinWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        @InjectRepository(Magazin) repo: Repository<Magazin>,
        readService: MagazinReadService,
        validationService: MagazinValidationService,
        mailService: MailService,
    ) {
        this.#repo = repo;
        this.#readService = readService;
        this.#validationService = validationService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Magazin soll angelegt werden.
     * @param magazin Das neu abzulegende Magazin
     * @returns Die ID des neu angelegten Magazines oder im Fehlerfall
     * [CreateError](../types/magazin_service_errors.CreateError.html)
     */
    async create(magazin: Magazin): Promise<CreateError | string> {
        this.#logger.debug('create: magazin=%o', magazin);
        const validateResult = await this.#validateCreate(magazin);
        if (validateResult !== undefined) {
            return validateResult;
        }

        magazin.id = uuid(); // eslint-disable-line require-atomic-updates
        magazin.schlagwoerter.forEach((schlagwort) => {
            schlagwort.id = uuid();
        });

        // implizite Transaktion
        const magazinDb = await this.#repo.save(removeissnDash(magazin)); // implizite Transaktion
        this.#logger.debug('create: magazinDb=%o', magazinDb);

        await this.#sendmail(magazinDb);

        return magazinDb.id!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein vorhandenes Magazin soll aktualisiert werden.
     * @param magazin Das zu aktualisierende Magazin
     * @param id ID des zu aktualisierenden Magazins
     * @param version Die Versionsnummer für optimistische Synchronisation
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     *  oder im Fehlerfall [UpdateError](../types/magazin_service_errors.UpdateError.html)
     */
    async update(
        id: string | undefined,
        magazin: Magazin,
        version: string,
    ): Promise<UpdateError | number> {
        this.#logger.debug(
            'update: id=%s, magazin=%o, version=%s',
            id,
            magazin,
            version,
        );
        if (id === undefined || !this.#validationService.validateId(id)) {
            this.#logger.debug('update: Keine gueltige ID');
            return { type: 'MagazinNotExists', id };
        }

        const validateResult = await this.#validateUpdate(magazin, id, version);
        this.#logger.debug('update: validateResult=%o', validateResult);
        if (!(validateResult instanceof Magazin)) {
            return validateResult;
        }

        const magazinNeu = validateResult;
        const merged = this.#repo.merge(magazinNeu, removeissnDash(magazin));
        this.#logger.debug('update: merged=%o', merged);
        const updated = await this.#repo.save(merged); // implizite Transaktion
        this.#logger.debug('update: updated=%o', updated);

        return updated.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein Magazin wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Magazines
     * @returns true, falls das Magazin vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: string) {
        this.#logger.debug('delete: id=%s', id);
        if (!this.#validationService.validateId(id)) {
            this.#logger.debug('delete: Keine gueltige ID');
            return false;
        }

        const magazin = await this.#readService.findById(id);
        if (magazin === undefined) {
            return false;
        }

        let deleteResult: DeleteResult | undefined;
        await this.#repo.manager.transaction(async (transactionalMgr) => {
            // Das Magazin zur gegebenen ID asynchron loeschen
            const { schlagwoerter } = magazin;
            const schlagwoerterIds = schlagwoerter.map(
                (schlagwort) => schlagwort.id,
            );
            const deleteResultSchlagwoerter = await transactionalMgr.delete(
                Schlagwort,
                schlagwoerterIds,
            );
            this.#logger.debug(
                'delete: deleteResultSchlagwoerter=%o',
                deleteResultSchlagwoerter,
            );
            deleteResult = await transactionalMgr.delete(Magazin, id);
            this.#logger.debug('delete: deleteResult=%o', deleteResult);
        });

        return (
            deleteResult?.affected !== undefined &&
            deleteResult.affected !== null &&
            deleteResult.affected > 0
        );
    }

    async #validateCreate(magazin: Magazin): Promise<CreateError | undefined> {
        const validateResult = this.#validationService.validate(magazin);
        if (validateResult !== undefined) {
            const messages = validateResult;
            this.#logger.debug('#validateCreate: messages=%o', messages);
            return { type: 'ConstraintViolations', messages };
        }

        const { titel } = magazin;
        let magazine = await this.#readService.find({ titel: titel }); // eslint-disable-line object-shorthand
        if (magazine.length > 0) {
            return { type: 'TitelExists', titel };
        }

        const { issn } = magazin;
        magazine = await this.#readService.find({ issn: issn }); // eslint-disable-line object-shorthand
        if (magazine.length > 0) {
            return { type: 'issnExists', issn };
        }

        this.#logger.debug('#validateCreate: ok');
        return undefined;
    }

    async #sendmail(magazin: Magazin) {
        const subject = `Neues Magazin ${magazin.id}`;
        const body = `Das Magazin mit dem Titel <strong>${magazin.titel}</strong> ist angelegt`;
        await this.#mailService.sendmail(subject, body);
    }

    async #validateUpdate(
        magazin: Magazin,
        id: string,
        versionStr: string,
    ): Promise<Magazin | UpdateError> {
        const result = this.#validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        this.#logger.debug(
            '#validateUpdate: magazin=%o, version=%s',
            magazin,
            version,
        );

        const validateResult = this.#validationService.validate(magazin);
        if (validateResult !== undefined) {
            const messages = validateResult;
            this.#logger.debug('#validateUpdate: messages=%o', messages);
            return { type: 'ConstraintViolations', messages };
        }

        const resultTitel = await this.#checkTitelExists(magazin);
        if (resultTitel !== undefined && resultTitel.id !== id) {
            return resultTitel;
        }

        const resultFindById = await this.#findByIdAndCheckVersion(id, version);
        this.#logger.debug('#validateUpdate: %o', resultFindById);
        return resultFindById;
    }

    #validateVersion(version: string | undefined): VersionInvalid | number {
        if (
            version === undefined ||
            !MagazinWriteService.VERSION_PATTERN.test(version)
        ) {
            const error: VersionInvalid = { type: 'VersionInvalid', version };
            this.#logger.debug('#validateVersion: VersionInvalid=%o', error);
            return error;
        }

        return Number.parseInt(version.slice(1, -1), 10);
    }

    async #checkTitelExists(
        magazin: Magazin,
    ): Promise<TitelExists | undefined> {
        const { titel } = magazin;

        const magazine = await this.#readService.find({ titel: titel }); // eslint-disable-line object-shorthand
        if (magazine.length > 0) {
            const [gefundenesMagazin] = magazine;
            const { id } = gefundenesMagazin!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
            this.#logger.debug('#checkTitelExists: id=%s', id);
            return { type: 'TitelExists', titel, id: id! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        }

        this.#logger.debug('#checkTitelExists: ok');
        return undefined;
    }

    async #findByIdAndCheckVersion(
        id: string,
        version: number,
    ): Promise<Magazin | MagazinNotExists | VersionOutdated> {
        const magazinDb = await this.#readService.findById(id);
        if (magazinDb === undefined) {
            const result: MagazinNotExists = { type: 'MagazinNotExists', id };
            this.#logger.debug(
                '#checkIdAndVersion: MagazinNotExists=%o',
                result,
            );
            return result;
        }

        // nullish coalescing
        const versionDb = magazinDb.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        if (version < versionDb) {
            const result: VersionOutdated = {
                type: 'VersionOutdated',
                id,
                version,
            };
            this.#logger.debug(
                '#checkIdAndVersion: VersionOutdated=%o',
                result,
            );
            return result;
        }

        return magazinDb;
    }
}
/* eslint-enable max-lines */
