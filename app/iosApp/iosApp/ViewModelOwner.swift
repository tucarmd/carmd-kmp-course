import Shared

// iOS has no ViewModelStoreOwner, so this class plays that role. Keep it in a view's
// @State (or a view controller's property). When it is deinitialised, clearing the store
// cancels every viewModelScope in it and calls onCleared().
final class ViewModelOwner {
    private let store = ViewModelStore()

    // Returns the store's instance of VM, creating it with the factory on first use.
    func viewModel<VM: ViewModel>(factory: any ViewModelProviderFactory) -> VM {
        do {
            return try store.resolveViewModel(modelClass: VM.self, factory: factory) as! VM
        } catch {
            fatalError("Couldn't create \(VM.self): \(error)")
        }
    }

    deinit {
        store.clear()
    }
}
