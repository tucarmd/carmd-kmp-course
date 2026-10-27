import UIKit

final class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        lifecycleLog.notice("ViewController viewDidLoad")
        title = "Lifecycle"
        view.backgroundColor = .systemBackground

        let button = UIButton(type: .system)
        button.setTitle("Open detail screen", for: .normal)
        button.addAction(UIAction { [weak self] _ in
            self?.navigationController?.pushViewController(DetailViewController(), animated: true)
        }, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(button)
        NSLayoutConstraint.activate([
            button.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            button.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        lifecycleLog.notice("ViewController viewWillAppear")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        lifecycleLog.notice("ViewController viewDidAppear")
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        lifecycleLog.notice("ViewController viewWillDisappear")
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        lifecycleLog.notice("ViewController viewDidDisappear")
    }
}

final class DetailViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        lifecycleLog.notice("DetailViewController viewDidLoad")
        view.backgroundColor = .systemBackground
        let label = UILabel()
        label.text = "Detail screen"
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }
    
    // UIT kit hay gì?>>>>
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        lifecycleLog.notice("DetailViewController viewWillAppear")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        lifecycleLog.notice("DetailViewController viewDidAppear")
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        lifecycleLog.notice("DetailViewController viewWillDisappear")
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        lifecycleLog.notice("DetailViewController viewDidDisappear")
    }
}
