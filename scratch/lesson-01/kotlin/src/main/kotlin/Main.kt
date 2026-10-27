// Lesson 01 — giả lập quét BLE: một Flow (lạnh) sinh thiết bị, một StateFlow (nóng)
// giữ trạng thái quét, main() in ra từng trạng thái nó thấy.

// Coroutines là thư viện (kotlinx.coroutines), không có sẵn trong ngôn ngữ → import từng tên.
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

// data class: compiler tự sinh equals/hashCode/toString/copy → so sánh theo giá trị.
// Toàn `val` (bất biến): kết quả quét là ảnh chụp, không ai sửa tại chỗ.
// `String?` = có thể null (TS: string | null) — thiết bị BLE có thể không có tên.
data class Device(val name: String?, val address: String, val rssi: Int)

// Extension function: thêm hàm label() cho Device mà không sửa class.
// `?:` (Elvis) = `??` của TS. `$x` / `${expr}` = template literal.
fun Device.label(): String = "${name ?: "Unknown"} ($address) $rssi dBm"

// sealed interface: tập con đóng, biết hết lúc compile (TS: discriminated union, khỏi cần `kind`).
sealed interface ScanState {
    data object Idle : ScanState                            // không có dữ liệu → object (singleton)
    data class Scanning(val found: Int) : ScanState         // đang quét, đã thấy `found` thiết bị
    data class Done(val devices: List<Device>) : ScanState  // xong, kèm danh sách cuối
}

// Flow LẠNH: gọi fakeScan() chưa chạy gì cả; thân flow { } chỉ chạy khi có ai collect.
fun fakeScan(): Flow<Device> = flow {
    val nearby = listOf(
        Device("OBD-II Dongle", "AA:01", -48),
        Device(null, "BB:02", -91),   // sóng yếu, sẽ bị filter loại
        Device("Heart Rate", "CC:03", -67),
    )
    for (device in nearby) {
        delay(900)     // suspend 300 ms, KHÔNG block thread — giả độ trễ của radio
        emit(device)   // đẩy 1 giá trị cho bên đang collect (bài 13: callback BLE thật thay dòng này)
    }
}

// Scanner nhận scope từ ngoài vào (không tự tạo) → người sở hữu scope quyết định tuổi thọ.
class Scanner(private val scope: CoroutineScope) {
    // Backing property: bản ghi được (private) + bản chỉ đọc (public). ViewModel nào cũng làm vậy.
    // Phải ghi rõ <ScanState>, không thì Kotlin suy ra MutableStateFlow<Idle>.
    private val _state = MutableStateFlow<ScanState>(ScanState.Idle)
    val state: StateFlow<ScanState> = _state.asStateFlow()

    // Không phải suspend: launch một coroutine trong scope rồi trả về ngay ("fire and track").
    fun start() {
        scope.launch {
            val found = mutableListOf<Device>()
            fakeScan()
                .filter { it.rssi > -80 }     // `it` = tham số duy nhất của lambda; tạo flow mới, chưa chạy
                .collect { device ->          // collect mới thực sự chạy fakeScan(); suspend tới khi flow xong
                    found += device
                    _state.value = ScanState.Scanning(found.size)  // phát trạng thái mới cho mọi collector
                }
            // Flow đã xong. toList() = bản sao chỉ đọc, để `found` đổi sau này không lọt vào Done.
            _state.value = ScanState.Done(found.toList())
        }
    }
}

// `when` là biểu thức và phải phủ hết mọi trường hợp; sealed nên không cần `else`.
// Thêm subtype thứ 4 → chỗ này hết compile cho tới khi xử lý.
fun render(state: ScanState): String = when (state) {
    ScanState.Idle -> "Idle"                                          // object → so sánh ==
    is ScanState.Scanning -> "Scanning… ${state.found} found"        // smart cast: state là Scanning
    is ScanState.Done -> "Done: " + state.devices.joinToString { it.label() }  // nối bằng ", "
}

// runBlocking: block thread main tới khi mọi coroutine bên trong xong. Chỉ dùng ở main/test.
// `: Unit` vì biểu thức cuối (first) trả về ScanState, còn main phải trả Unit.
fun main(): Unit = runBlocking {
    val scanner = Scanner(scope = this)  // `this` là CoroutineScope của runBlocking → scan là con của main
    scanner.start()                      // chỉ xếp hàng coroutine; nó chạy khi main suspend
    scanner.state
        .onEach { println(render(it)) }    // in mọi trạng thái collector nhận được
        .first { it is ScanState.Done }    // StateFlow không bao giờ kết thúc → dừng khi gặp Done
    // Chỉ in 3 dòng, không có "Scanning… 2 found": StateFlow bị conflate — Scanning(2) và Done
    // được ghi liền nhau trong cùng coroutine, lúc collector chạy thì chỉ còn Done.
}
