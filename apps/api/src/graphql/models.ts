import { Field, GraphQLISODateTime, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { DocumentStatus, ExportStatus, MessageRole, MessageStatus, OrgRole } from '@lexbridge/database';

registerEnumType(OrgRole, { name: 'OrgRole' });
registerEnumType(DocumentStatus, { name: 'DocumentStatus' });
registerEnumType(MessageRole, { name: 'MessageRole' });
registerEnumType(MessageStatus, { name: 'MessageStatus' });
registerEnumType(ExportStatus, { name: 'ExportStatus' });

@ObjectType()
export class UserModel {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class OrganizationModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field(() => OrgRole)
  role!: OrgRole;
}

@ObjectType()
export class MemberModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field(() => OrgRole)
  role!: OrgRole;
}

@ObjectType()
export class InvitationModel {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => OrgRole)
  role!: OrgRole;

  @Field()
  acceptUrl!: string;

  @Field(() => GraphQLISODateTime)
  expiresAt!: Date;
}

@ObjectType()
export class DocumentModel {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => DocumentStatus)
  status!: DocumentStatus;

  @Field(() => ID)
  organizationId!: string;
}

@ObjectType()
export class CitationModel {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;

  @Field()
  excerpt!: string;

  @Field(() => ID)
  documentId!: string;
}

@ObjectType()
export class MessageModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => MessageRole)
  role!: MessageRole;

  @Field()
  content!: string;

  @Field(() => MessageStatus)
  status!: MessageStatus;

  @Field()
  sequence!: number;

  @Field()
  insufficient!: boolean;

  @Field(() => [CitationModel])
  citations!: CitationModel[];
}

@ObjectType()
export class ConversationModel {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => [MessageModel])
  messages!: MessageModel[];
}

@ObjectType()
export class ConversationSummaryModel {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class ExportJobModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => ExportStatus)
  status!: ExportStatus;

  @Field()
  attempts!: number;

  @Field(() => String, { nullable: true })
  error!: string | null;
}

@ObjectType()
export class AuditLogModel {
  @Field(() => ID)
  id!: string;

  @Field()
  action!: string;

  @Field()
  targetType!: string;

  @Field()
  targetId!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@InputType()
export class InviteUserInput {
  @Field()
  email!: string;

  @Field(() => OrgRole)
  role!: OrgRole;
}

@InputType()
export class ChangeRoleInput {
  @Field(() => ID)
  membershipId!: string;

  @Field(() => OrgRole)
  role!: OrgRole;
}

@InputType()
export class CreateDocumentInput {
  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field()
  publish!: boolean;
}

@InputType()
export class AskQuestionInput {
  @Field(() => ID, { nullable: true })
  conversationId?: string;

  @Field()
  question!: string;
}
