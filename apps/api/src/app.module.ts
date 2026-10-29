import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@lexbridge/database';
import { PDF_EXPORT_QUEUE } from '@lexbridge/shared';
import { Request, Response } from 'express';
import { selectLlmClient } from './ai/llm-client';
import { PostgresRetriever } from './ai/postgres-retriever';
import { AuthContextService } from './auth/auth-context.service';
import { AuthModule } from './auth/auth.module';
import { LLM_CLIENT } from './chat/chat-generation.service';
import { ChatGenerationService } from './chat/chat-generation.service';
import { ChatService } from './chat/chat.service';
import { appConfig } from './config';
import { RedisModule } from './common/redis.module';
import { DocumentsService } from './documents/documents.service';
import { ExportsService } from './exports/exports.service';
import { ChatResolver } from './graphql/chat.resolver';
import { DirectoryResolver } from './graphql/directory.resolver';
import { HttpApiController } from './http-api.controller';
import { AuditService, OrganizationsService } from './organizations/organizations.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    BullModule.forRoot({
      connection: {
        url: appConfig().redisUrl,
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue({ name: PDF_EXPORT_QUEUE }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [AuthContextService],
      useFactory: (auth: AuthContextService) => ({
        autoSchemaFile: true,
        sortSchema: true,
        context: async ({ req, res }: { req: Request; res: Response }) => ({
          ...(await auth.build(req)),
          res,
        }),
      }),
    }),
  ],
  controllers: [HttpApiController],
  providers: [
    AuditService,
    OrganizationsService,
    DocumentsService,
    PostgresRetriever,
    { provide: LLM_CLIENT, useFactory: () => selectLlmClient() },
    ChatGenerationService,
    ChatService,
    ExportsService,
    DirectoryResolver,
    ChatResolver,
  ],
})
export class AppModule {}
