/*
 *
 * 函数节流
 *
 */
function throttle(fn, interval) {
    var timer, // 定时器
        firstTime = true; // 是否是第一次使用

    return function() {
        var args = arguments,
            self = this;

        // 第一次使用
        if (firstTime) {
            fn.apply(self, args);

            return firstTime = false;
        }

        // 定时器还存在
        if (timer) {
            return false;
        }

        // 延迟执行
        timer = setTimeout(function() {
            clearTimeout(timer);
            timer = null;
            fn.apply(self, args);
        }, interval || 500);
    }
}