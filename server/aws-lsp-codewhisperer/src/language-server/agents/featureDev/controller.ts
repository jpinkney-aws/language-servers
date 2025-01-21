import { Features } from '../../types'
import { ChatSessionManagementService } from '../../chat/chatSessionManagementService'
import { TelemetryService } from '../../telemetryService'
import { BaseController } from '../baseController'

export interface SessionState {}

export class FeatureDevController extends BaseController<SessionState> {
    constructor(
        chatSessionManagementService: ChatSessionManagementService<SessionState>,
        features: Features,
        telemetryService: TelemetryService
    ) {
        super(chatSessionManagementService, features, telemetryService)
    }
}
