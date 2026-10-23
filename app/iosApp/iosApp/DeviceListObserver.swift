import Observation
import Shared

// Until Lesson 09: the hand-written bridge. Owns the shared ViewModel and mirrors its
// StateFlow into an @Observable property that SwiftUI can read. Lesson 09 deletes this file.
@Observable
final class DeviceListObserver {
    @ObservationIgnored let viewModel: DeviceListViewModel
    private(set) var state: DeviceListUiState

    @ObservationIgnored private let owner: ViewModelOwner
    @ObservationIgnored private var watch: Watch?

    init() {
        let owner = ViewModelOwner()
        let viewModel: DeviceListViewModel = owner.viewModel(factory: DeviceListViewModel.companion.Factory)
        let watcher = StateFlowWatcher<DeviceListUiState>(flow: viewModel.uiState)
        self.owner = owner
        self.viewModel = viewModel
        self.state = watcher.value
        watch = watcher.watch { [weak self] newState in
            self?.state = newState
        }
    }

    deinit {
        watch?.cancel()
    }
}
