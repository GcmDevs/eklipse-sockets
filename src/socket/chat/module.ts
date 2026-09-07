import { ChatAccessService, ManageChatAccessService } from './infrastructure/services/access';
import { ChatAccessController } from './presentation/controllers';
import { Module } from '@nestjs/common';
import {
  ChatGateway,
  DeleteMessageImpl,
  DisableSecurityImpl,
  EditMessageImpl,
  EnableSecurityImpl,
  HandleDisconnectImpl,
  handleConnectionImpl,
  HideConversationImpl,
  LoadPreviousMessagesImpl,
  LockSecurityImpl,
  MarkConversationReadImpl,
  OpenConversationImpl,
  SearchUsersImpl,
  SecurityActivityImpl,
  SendMessageImpl,
  StartConversationImpl,
  UnlockSecurityImpl,
  UpdateTypingImpl,
} from './presentation/gateways';
import { FileSaverModule } from '@file-saver/module';
import { SocketCommonModule } from '@socket/common/module';
import {
  ChatAddMessageImpl,
  ChatDeleteMessageImpl,
  ChatDirectoryFindByDocumentImpl,
  ChatDirectoryFindByIdsImpl,
  ChatDirectorySearchImpl,
  ChatDirectoryService,
  ChatEditMessageImpl,
  ChatHideConversationImpl,
  ChatListForImpl,
  ChatLoadPreviousMessagesImpl,
  ChatMarkConversationReadImpl,
  ChatOpenImpl,
  ChatParticipantsImpl,
  ChatPeersForImpl,
  ChatSecurityDisableImpl,
  ChatSecurityEnableImpl,
  ChatSecurityIsEnabledImpl,
  ChatSecurityIsValidPinImpl,
  ChatSecurityService,
  ChatSecurityVerifyImpl,
  ChatStartImpl,
  ChatStoreService,
  ChatUnreadCountForImpl,
} from './infrastructure/services';

const DIRECTORY_SERVICES = [
  ChatDirectorySearchImpl,
  ChatDirectoryFindByDocumentImpl,
  ChatDirectoryFindByIdsImpl,
  ChatDirectoryService,
];

const SECURITY_SERVICES = [
  ChatSecurityIsValidPinImpl,
  ChatSecurityIsEnabledImpl,
  ChatSecurityEnableImpl,
  ChatSecurityVerifyImpl,
  ChatSecurityDisableImpl,
  ChatSecurityService,
];

const STORE_SERVICES = [
  ChatStartImpl,
  ChatOpenImpl,
  ChatMarkConversationReadImpl,
  ChatHideConversationImpl,
  ChatLoadPreviousMessagesImpl,
  ChatAddMessageImpl,
  ChatEditMessageImpl,
  ChatDeleteMessageImpl,
  ChatListForImpl,
  ChatUnreadCountForImpl,
  ChatParticipantsImpl,
  ChatPeersForImpl,
  ChatStoreService,
];

const ACCESS_SERVICES = [ManageChatAccessService, ChatAccessService];

const GATEWAYS_SERVICES = [
  ChatGateway,
  handleConnectionImpl,
  HandleDisconnectImpl,
  EnableSecurityImpl,
  UnlockSecurityImpl,
  DisableSecurityImpl,
  LockSecurityImpl,
  SecurityActivityImpl,
  SearchUsersImpl,
  StartConversationImpl,
  OpenConversationImpl,
  MarkConversationReadImpl,
  HideConversationImpl,
  LoadPreviousMessagesImpl,
  UpdateTypingImpl,
  SendMessageImpl,
  EditMessageImpl,
  DeleteMessageImpl,
];

@Module({
  controllers: [ChatAccessController],
  imports: [SocketCommonModule, FileSaverModule],
  providers: [
    ...ACCESS_SERVICES,
    ...DIRECTORY_SERVICES,
    ...SECURITY_SERVICES,
    ...STORE_SERVICES,
    ...GATEWAYS_SERVICES,
  ],
})
export class ChatModule {}
