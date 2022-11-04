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
import { AuthModule } from '../security/auth/auth.module.js';
import { Magazin } from './entity/magazin.entity.js';
import { MagazinGetController } from './rest/magazin-get.controller.js';
import { MagazinMutationResolver } from './graphql/magazin-mutation.resolver.js';
import { MagazinQueryResolver } from './graphql/magazin-query.resolver.js';
import { MagazinReadService } from './service/magazin-read.service.js';
import { MagazinValidationService } from './service/magazin-validation.service.js';
import { MagazinWriteController } from './rest/magazin-write.controller.js';
import { MagazinWriteService } from './service/magazin-write.service.js';
import { MailModule } from '../mail/mail.module.js';
import { Module } from '@nestjs/common';
import { QueryBuilder } from './service/query-builder.js';
import { Schlagwort } from './entity/schlagwort.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Das Modul besteht aus Controller- und Service-Klassen für die Verwaltung von
 * Bücher.
 * @packageDocumentation
 */

/**
 * Die dekorierte Modul-Klasse mit Controller- und Service-Klassen sowie der
 * Funktionalität für TypeORM.
 */
@Module({
    imports: [
        MailModule,
        // siehe auch src\app.module.ts
        TypeOrmModule.forFeature([Magazin, Schlagwort]),
        AuthModule,
    ],
    controllers: [MagazinGetController, MagazinWriteController],
    // Provider sind z.B. Service-Klassen fuer DI
    providers: [
        MagazinReadService,
        MagazinWriteService,
        MagazinValidationService,
        MagazinQueryResolver,
        MagazinMutationResolver,
        QueryBuilder,
    ],
    // Export der Provider fuer DI in anderen Modulen
    exports: [
        MagazinReadService,
        MagazinWriteService,
        MagazinValidationService,
    ],
})
export class MagazinModule {}
