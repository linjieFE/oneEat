"use strict";
var app = getApp();
function inArray(arr, key, val) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i][key] === val) {
            return i;
        }
    }
    return -1;
}
function ab2hex(buffer) {
    var hexArr = Array.prototype.map.call(new Uint8Array(buffer), function (bit) {
        return ('00' + bit.toString(16)).slice(-2);
    });
    return hexArr.join('');
}
Page({
    data: {
        motto: 'Hello World',
        userInfo: {},
        hasUserInfo: false,
        canIUse: wx.canIUse('button.open-type.getUserInfo'),
        devices: [],
        connected: false,
        chs: [],
    },
    bindViewTap2: function () {
        wx.navigateTo({
            url: '../logs/logs',
        });
    },
    onLoad: function () {
        var _this = this;
        if (app.globalData.userInfo) {
            this.setData({
                userInfo: app.globalData.userInfo,
                hasUserInfo: true,
            });
        }
        else if (this.data.canIUse) {
            app.userInfoReadyCallback = function (res) {
                _this.setData({
                    userInfo: res.userInfo,
                    hasUserInfo: true,
                });
            };
        }
        else {
            wx.getUserInfo({
                success: function (res) {
                    app.globalData.userInfo = res.userInfo;
                    _this.setData({
                        userInfo: res.userInfo,
                        hasUserInfo: true,
                    });
                },
            });
        }
    },
    getUserInfo: function (e) {
        console.log(e);
        app.globalData.userInfo = e.detail.userInfo;
        this.setData({
            userInfo: e.detail.userInfo,
            hasUserInfo: true,
        });
    },
    openBluetoothAdapter: function () {
        var _this = this;
        wx.openBluetoothAdapter({
            success: function (res) {
                console.log('openBluetoothAdapter success', res);
                _this.startBluetoothDevicesDiscovery();
            },
            fail: function (res) {
                if (res.errCode === 10001) {
                    wx.onBluetoothAdapterStateChange(function (res) {
                        console.log('onBluetoothAdapterStateChange', res);
                        if (res.available) {
                            this.startBluetoothDevicesDiscovery();
                        }
                    });
                }
            }
        });
    },
    getBluetoothAdapterState: function () {
        var _this = this;
        wx.getBluetoothAdapterState({
            success: function (res) {
                console.log('getBluetoothAdapterState', res);
                if (res.discovering) {
                    _this.onBluetoothDeviceFound();
                }
                else if (res.available) {
                    _this.startBluetoothDevicesDiscovery();
                }
            }
        });
    },
    startBluetoothDevicesDiscovery: function () {
        var _this = this;
        if (this._discoveryStarted) {
            return;
        }
        this._discoveryStarted = true;
        wx.startBluetoothDevicesDiscovery({
            allowDuplicatesKey: true,
            success: function (res) {
                console.log('startBluetoothDevicesDiscovery success', res);
                _this.onBluetoothDeviceFound();
            },
        });
    },
    stopBluetoothDevicesDiscovery: function () {
        wx.stopBluetoothDevicesDiscovery();
    },
    onBluetoothDeviceFound: function () {
        var _this = this;
        wx.onBluetoothDeviceFound(function (res) {
            res.devices.forEach(function (device) {
                if (!device.name && !device.localName) {
                    return;
                }
                var foundDevices = _this.data.devices;
                var idx = inArray(foundDevices, 'deviceId', device.deviceId);
                var data = {};
                if (idx === -1) {
                    data["devices[" + foundDevices.length + "]"] = device;
                }
                else {
                    data["devices[" + idx + "]"] = device;
                }
                _this.setData(data);
            });
        });
    },
    createBLEConnection: function (e) {
        var _this = this;
        var ds = e.currentTarget.dataset;
        var deviceId = ds.deviceId;
        var name = ds.name;
        wx.createBLEConnection({
            deviceId: deviceId,
            success: function () {
                _this.setData({
                    connected: true,
                    name: name,
                    deviceId: deviceId,
                });
                _this.getBLEDeviceServices(deviceId);
            }
        });
        this.stopBluetoothDevicesDiscovery();
    },
    closeBLEConnection: function () {
        wx.closeBLEConnection({
            deviceId: this.data.deviceId
        });
        this.setData({
            connected: false,
            chs: [],
            canWrite: false,
        });
    },
    getBLEDeviceServices: function (deviceId) {
        var _this = this;
        wx.getBLEDeviceServices({
            deviceId: deviceId,
            success: function (res) {
                for (var i = 0; i < res.services.length; i++) {
                    if (res.services[i].isPrimary) {
                        _this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid);
                        return;
                    }
                }
            }
        });
    },
    getBLEDeviceCharacteristics: function (deviceId, serviceId) {
        var _this = this;
        wx.getBLEDeviceCharacteristics({
            deviceId: deviceId,
            serviceId: serviceId,
            success: function (res) {
                console.log('getBLEDeviceCharacteristics success', res.characteristics);
                for (var i = 0; i < res.characteristics.length; i++) {
                    var item = res.characteristics[i];
                    if (item.properties.read) {
                        wx.readBLECharacteristicValue({
                            deviceId: deviceId,
                            serviceId: serviceId,
                            characteristicId: item.uuid,
                        });
                    }
                    if (item.properties.write) {
                        _this.setData({
                            canWrite: true
                        });
                        _this._deviceId = deviceId;
                        _this._serviceId = serviceId;
                        _this._characteristicId = item.uuid;
                        _this.writeBLECharacteristicValue();
                    }
                    if (item.properties.notify || item.properties.indicate) {
                        wx.notifyBLECharacteristicValueChange({
                            deviceId: deviceId,
                            serviceId: serviceId,
                            characteristicId: item.uuid,
                            state: true,
                        });
                    }
                }
            },
            fail: function (res) {
                console.error('getBLEDeviceCharacteristics', res);
            }
        });
        wx.onBLECharacteristicValueChange(function (characteristic) {
            var idx = inArray(_this.data.chs, 'uuid', characteristic.characteristicId);
            var data = {};
            if (idx === -1) {
                data["chs[" + _this.data.chs.length + "]"] = {
                    uuid: characteristic.characteristicId,
                    value: ab2hex(characteristic.value)
                };
            }
            else {
                data["chs[" + idx + "]"] = {
                    uuid: characteristic.characteristicId,
                    value: ab2hex(characteristic.value)
                };
            }
            _this.setData(data);
        });
    },
    writeBLECharacteristicValue: function () {
        var buffer = new ArrayBuffer(1);
        var dataView = new DataView(buffer);
        dataView.setUint8(0, Math.random() * 255 | 0);
        wx.writeBLECharacteristicValue({
            deviceId: this._deviceId,
            serviceId: this._deviceId,
            characteristicId: this._characteristicId,
            value: buffer,
        });
    },
    closeBluetoothAdapter: function () {
        wx.closeBluetoothAdapter();
        this._discoveryStarted = false;
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBR0EsSUFBTSxHQUFHLEdBQUcsTUFBTSxFQUFjLENBQUE7QUFFaEMsU0FBUyxPQUFPLENBQUMsR0FBbUIsRUFBRSxHQUFXLEVBQUUsR0FBVztJQUM1RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNuQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDdkIsT0FBTyxDQUFDLENBQUM7U0FDVjtLQUNGO0lBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNaLENBQUM7QUFHRCxTQUFTLE1BQU0sQ0FBQyxNQUE0QjtJQUMxQyxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQ25DLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUN0QixVQUFVLEdBQUc7UUFDWCxPQUFPLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUM1QyxDQUFDLENBQ0YsQ0FBQTtJQUNELE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QixDQUFDO0FBRUQsSUFBSSxDQUFDO0lBQ0gsSUFBSSxFQUFFO1FBQ0osS0FBSyxFQUFFLGFBQWE7UUFDcEIsUUFBUSxFQUFFLEVBQUU7UUFDWixXQUFXLEVBQUUsS0FBSztRQUNsQixPQUFPLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQztRQUNuRCxPQUFPLEVBQUUsRUFBRTtRQUNYLFNBQVMsRUFBRSxLQUFLO1FBQ2hCLEdBQUcsRUFBRSxFQUFFO0tBQ1I7SUFRRCxZQUFZ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QUFDLENBQUMsQ0FBQTtJQUNKLENBQUM7SUFDRCwyQkFBMkI7UUFFekIsSUFBSSxNQUFNLEdBQUcsSUFBSSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFDL0IsSUFBSSxRQUFRLEdBQUcsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDbkMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQTtRQUM3QyxFQUFFLENBQUMsMkJBQTJCLENBQUM7WUFDN0IsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQ3hCLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztZQUN6QixnQkFBZ0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCO1lBQ3hDLEtBQUssRUFBRSxNQUFNO1NBQ2QsQ0FBQyxDQUFBO0lBQ0osQ0FBQztJQUNELHFCQUFxQjtRQUNuQixFQUFFLENBQUMscUJBQXFCLEVBQUUsQ0FBQTtRQUMxQixJQUFJLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFBO0lBQ2hDLENBQUM7Q0FDRixDQUFDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBpbmRleC50c1xuLy8g6I635Y+W5bqU55So5a6e5L6LXG4vLyBAdHMtbm9jaGVja1xuY29uc3QgYXBwID0gZ2V0QXBwPElBcHBPcHRpb24+KClcblxuZnVuY3Rpb24gaW5BcnJheShhcnI6IHN0cmluZyB8IGFueVtdLCBrZXk6IHN0cmluZywgdmFsOiBzdHJpbmcpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoYXJyW2ldW2tleV0gPT09IHZhbCkge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG4gIHJldHVybiAtMTtcbn1cblxuLy8gQXJyYXlCdWZmZXLovawxNui/m+W6puWtl+espuS4suekuuS+i1xuZnVuY3Rpb24gYWIyaGV4KGJ1ZmZlcjogbnVtYmVyIHwgQXJyYXlCdWZmZXIpIHtcbiAgdmFyIGhleEFyciA9IEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChcbiAgICBuZXcgVWludDhBcnJheShidWZmZXIpLFxuICAgIGZ1bmN0aW9uIChiaXQpIHtcbiAgICAgIHJldHVybiAoJzAwJyArIGJpdC50b1N0cmluZygxNikpLnNsaWNlKC0yKVxuICAgIH1cbiAgKVxuICByZXR1cm4gaGV4QXJyLmpvaW4oJycpO1xufVxuXG5QYWdlKHtcbiAgZGF0YToge1xuICAgIG1vdHRvOiAnSGVsbG8gV29ybGQnLFxuICAgIHVzZXJJbmZvOiB7fSxcbiAgICBoYXNVc2VySW5mbzogZmFsc2UsXG4gICAgY2FuSVVzZTogd3guY2FuSVVzZSgnYnV0dG9uLm9wZW4tdHlwZS5nZXRVc2VySW5mbycpLFxuICAgIGRldmljZXM6IFtdLFxuICAgIGNvbm5lY3RlZDogZmFsc2UsXG4gICAgY2hzOiBbXSxcbiAgfSxcbiAgLy8g5LqL5Lu25aSE55CG5Ye95pWwXG4gIC8vIGJpbmRWaWV3VGFwKCkge1xuICAvLyAgIHd4Lm5hdmlnYXRlVG8oe1xuICAvLyAgICAgdXJsOiAnLi4vbG9ncy9sb2dzJyxcbiAgLy8gICB9KVxuICAvLyB9LFxuICAvLyDkuovku7blpITnkIblh73mlbBcbiAgYmluZFZpZXdUYXAyKCkge1xuICAgIHd4Lm5hdmlnYXRlVG8oe1xuICAgICAgdXJsOiAnLi4vbG9ncy9sb2dzJyxcbiAgICB9KVxuICB9LFxuICBvbkxvYWQoKSB7XG4gICAgaWYgKGFwcC5nbG9iYWxEYXRhLnVzZXJJbmZvKSB7XG4gICAgICB0aGlzLnNldERhdGEoe1xuICAgICAgICB1c2VySW5mbzogYXBwLmdsb2JhbERhdGEudXNlckluZm8sXG4gICAgICAgIGhhc1VzZXJJbmZvOiB0cnVlLFxuICAgICAgfSlcbiAgICB9IGVsc2UgaWYgKHRoaXMuZGF0YS5jYW5JVXNlKSB7XG4gICAgICAvLyDnlLHkuo4gZ2V0VXNlckluZm8g5piv572R57uc6K+35rGC77yM5Y+v6IO95Lya5ZyoIFBhZ2Uub25Mb2FkIOS5i+WQjuaJjei/lOWbnlxuICAgICAgLy8g5omA5Lul5q2k5aSE5Yqg5YWlIGNhbGxiYWNrIOS7pemYsuatoui/meenjeaDheWGtVxuICAgICAgYXBwLnVzZXJJbmZvUmVhZHlDYWxsYmFjayA9IHJlcyA9PiB7XG4gICAgICAgIHRoaXMuc2V0RGF0YSh7XG4gICAgICAgICAgdXNlckluZm86IHJlcy51c2VySW5mbyxcbiAgICAgICAgICBoYXNVc2VySW5mbzogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8g5Zyo5rKh5pyJIG9wZW4tdHlwZT1nZXRVc2VySW5mbyDniYjmnKznmoTlhbzlrrnlpITnkIZcbiAgICAgIHd4LmdldFVzZXJJbmZvKHtcbiAgICAgICAgc3VjY2VzczogcmVzID0+IHtcbiAgICAgICAgICBhcHAuZ2xvYmFsRGF0YS51c2VySW5mbyA9IHJlcy51c2VySW5mb1xuICAgICAgICAgIHRoaXMuc2V0RGF0YSh7XG4gICAgICAgICAgICB1c2VySW5mbzogcmVzLnVzZXJJbmZvLFxuICAgICAgICAgICAgaGFzVXNlckluZm86IHRydWUsXG4gICAgICAgICAgfSlcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICBnZXRVc2VySW5mbyhlOiBhbnkpIHtcbiAgICBjb25zb2xlLmxvZyhlKVxuICAgIGFwcC5nbG9iYWxEYXRhLnVzZXJJbmZvID0gZS5kZXRhaWwudXNlckluZm9cbiAgICB0aGlzLnNldERhdGEoe1xuICAgICAgdXNlckluZm86IGUuZGV0YWlsLnVzZXJJbmZvLFxuICAgICAgaGFzVXNlckluZm86IHRydWUsXG4gICAgfSlcbiAgfSxcbiAgb3BlbkJsdWV0b290aEFkYXB0ZXIoKSB7XG4gICAgd3gub3BlbkJsdWV0b290aEFkYXB0ZXIoe1xuICAgICAgc3VjY2VzczogKHJlcykgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnb3BlbkJsdWV0b290aEFkYXB0ZXIgc3VjY2VzcycsIHJlcylcbiAgICAgICAgdGhpcy5zdGFydEJsdWV0b290aERldmljZXNEaXNjb3ZlcnkoKVxuICAgICAgfSxcbiAgICAgIGZhaWw6IChyZXMpID0+IHtcbiAgICAgICAgaWYgKHJlcy5lcnJDb2RlID09PSAxMDAwMSkge1xuICAgICAgICAgIHd4Lm9uQmx1ZXRvb3RoQWRhcHRlclN0YXRlQ2hhbmdlKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdvbkJsdWV0b290aEFkYXB0ZXJTdGF0ZUNoYW5nZScsIHJlcylcbiAgICAgICAgICAgIGlmIChyZXMuYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgIHRoaXMuc3RhcnRCbHVldG9vdGhEZXZpY2VzRGlzY292ZXJ5KClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSlcbiAgfSxcbiAgZ2V0Qmx1ZXRvb3RoQWRhcHRlclN0YXRlKCkge1xuICAgIHd4LmdldEJsdWV0b290aEFkYXB0ZXJTdGF0ZSh7XG4gICAgICBzdWNjZXNzOiAocmVzKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdnZXRCbHVldG9vdGhBZGFwdGVyU3RhdGUnLCByZXMpXG4gICAgICAgIGlmIChyZXMuZGlzY292ZXJpbmcpIHtcbiAgICAgICAgICB0aGlzLm9uQmx1ZXRvb3RoRGV2aWNlRm91bmQoKVxuICAgICAgICB9IGVsc2UgaWYgKHJlcy5hdmFpbGFibGUpIHtcbiAgICAgICAgICB0aGlzLnN0YXJ0Qmx1ZXRvb3RoRGV2aWNlc0Rpc2NvdmVyeSgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KVxuICB9LFxuICBzdGFydEJsdWV0b290aERldmljZXNEaXNjb3ZlcnkoKSB7XG4gICAgaWYgKHRoaXMuX2Rpc2NvdmVyeVN0YXJ0ZWQpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICB0aGlzLl9kaXNjb3ZlcnlTdGFydGVkID0gdHJ1ZVxuICAgIHd4LnN0YXJ0Qmx1ZXRvb3RoRGV2aWNlc0Rpc2NvdmVyeSh7XG4gICAgICBhbGxvd0R1cGxpY2F0ZXNLZXk6IHRydWUsXG4gICAgICBzdWNjZXNzOiAocmVzKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdzdGFydEJsdWV0b290aERldmljZXNEaXNjb3Zlcnkgc3VjY2VzcycsIHJlcylcbiAgICAgICAgdGhpcy5vbkJsdWV0b290aERldmljZUZvdW5kKClcbiAgICAgIH0sXG4gICAgfSlcbiAgfSxcbiAgc3RvcEJsdWV0b290aERldmljZXNEaXNjb3ZlcnkoKSB7XG4gICAgd3guc3RvcEJsdWV0b290aERldmljZXNEaXNjb3ZlcnkoKVxuICB9LFxuICBvbkJsdWV0b290aERldmljZUZvdW5kKCkge1xuICAgIHd4Lm9uQmx1ZXRvb3RoRGV2aWNlRm91bmQoKHJlcykgPT4ge1xuICAgICAgcmVzLmRldmljZXMuZm9yRWFjaChkZXZpY2UgPT4ge1xuICAgICAgICBpZiAoIWRldmljZS5uYW1lICYmICFkZXZpY2UubG9jYWxOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZm91bmREZXZpY2VzID0gdGhpcy5kYXRhLmRldmljZXNcbiAgICAgICAgY29uc3QgaWR4ID0gaW5BcnJheShmb3VuZERldmljZXMsICdkZXZpY2VJZCcsIGRldmljZS5kZXZpY2VJZClcbiAgICAgICAgY29uc3QgZGF0YSA9IHt9XG4gICAgICAgIGlmIChpZHggPT09IC0xKSB7XG4gICAgICAgICAgZGF0YVtgZGV2aWNlc1ske2ZvdW5kRGV2aWNlcy5sZW5ndGh9XWBdID0gZGV2aWNlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGF0YVtgZGV2aWNlc1ske2lkeH1dYF0gPSBkZXZpY2VcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNldERhdGEoZGF0YSlcbiAgICAgIH0pXG4gICAgfSlcbiAgfSxcbiAgY3JlYXRlQkxFQ29ubmVjdGlvbihlOiB7IGN1cnJlbnRUYXJnZXQ6IHsgZGF0YXNldDogYW55OyB9OyB9KSB7XG4gICAgY29uc3QgZHMgPSBlLmN1cnJlbnRUYXJnZXQuZGF0YXNldFxuICAgIGNvbnN0IGRldmljZUlkID0gZHMuZGV2aWNlSWRcbiAgICBjb25zdCBuYW1lID0gZHMubmFtZVxuICAgIHd4LmNyZWF0ZUJMRUNvbm5lY3Rpb24oe1xuICAgICAgZGV2aWNlSWQsXG4gICAgICBzdWNjZXNzOiAoKSA9PiB7XG4gICAgICAgIHRoaXMuc2V0RGF0YSh7XG4gICAgICAgICAgY29ubmVjdGVkOiB0cnVlLFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgZGV2aWNlSWQsXG4gICAgICAgIH0pXG4gICAgICAgIHRoaXMuZ2V0QkxFRGV2aWNlU2VydmljZXMoZGV2aWNlSWQpXG4gICAgICB9XG4gICAgfSlcbiAgICB0aGlzLnN0b3BCbHVldG9vdGhEZXZpY2VzRGlzY292ZXJ5KClcbiAgfSxcbiAgY2xvc2VCTEVDb25uZWN0aW9uKCkge1xuICAgIHd4LmNsb3NlQkxFQ29ubmVjdGlvbih7XG4gICAgICBkZXZpY2VJZDogdGhpcy5kYXRhLmRldmljZUlkXG4gICAgfSlcbiAgICB0aGlzLnNldERhdGEoe1xuICAgICAgY29ubmVjdGVkOiBmYWxzZSxcbiAgICAgIGNoczogW10sXG4gICAgICBjYW5Xcml0ZTogZmFsc2UsXG4gICAgfSlcbiAgfSxcbiAgZ2V0QkxFRGV2aWNlU2VydmljZXMoZGV2aWNlSWQ6IGFueSkge1xuICAgIHd4LmdldEJMRURldmljZVNlcnZpY2VzKHtcbiAgICAgIGRldmljZUlkLFxuICAgICAgc3VjY2VzczogKHJlcykgPT4ge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlcy5zZXJ2aWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChyZXMuc2VydmljZXNbaV0uaXNQcmltYXJ5KSB7XG4gICAgICAgICAgICB0aGlzLmdldEJMRURldmljZUNoYXJhY3RlcmlzdGljcyhkZXZpY2VJZCwgcmVzLnNlcnZpY2VzW2ldLnV1aWQpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KVxuICB9LFxuICBnZXRCTEVEZXZpY2VDaGFyYWN0ZXJpc3RpY3MoZGV2aWNlSWQsIHNlcnZpY2VJZCkge1xuICAgIHd4LmdldEJMRURldmljZUNoYXJhY3RlcmlzdGljcyh7XG4gICAgICBkZXZpY2VJZCxcbiAgICAgIHNlcnZpY2VJZCxcbiAgICAgIHN1Y2Nlc3M6IChyZXMpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ2dldEJMRURldmljZUNoYXJhY3RlcmlzdGljcyBzdWNjZXNzJywgcmVzLmNoYXJhY3RlcmlzdGljcylcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXMuY2hhcmFjdGVyaXN0aWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgbGV0IGl0ZW0gPSByZXMuY2hhcmFjdGVyaXN0aWNzW2ldXG4gICAgICAgICAgaWYgKGl0ZW0ucHJvcGVydGllcy5yZWFkKSB7XG4gICAgICAgICAgICB3eC5yZWFkQkxFQ2hhcmFjdGVyaXN0aWNWYWx1ZSh7XG4gICAgICAgICAgICAgIGRldmljZUlkLFxuICAgICAgICAgICAgICBzZXJ2aWNlSWQsXG4gICAgICAgICAgICAgIGNoYXJhY3RlcmlzdGljSWQ6IGl0ZW0udXVpZCxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpdGVtLnByb3BlcnRpZXMud3JpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RGF0YSh7XG4gICAgICAgICAgICAgIGNhbldyaXRlOiB0cnVlXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgdGhpcy5fZGV2aWNlSWQgPSBkZXZpY2VJZFxuICAgICAgICAgICAgdGhpcy5fc2VydmljZUlkID0gc2VydmljZUlkXG4gICAgICAgICAgICB0aGlzLl9jaGFyYWN0ZXJpc3RpY0lkID0gaXRlbS51dWlkXG4gICAgICAgICAgICB0aGlzLndyaXRlQkxFQ2hhcmFjdGVyaXN0aWNWYWx1ZSgpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpdGVtLnByb3BlcnRpZXMubm90aWZ5IHx8IGl0ZW0ucHJvcGVydGllcy5pbmRpY2F0ZSkge1xuICAgICAgICAgICAgd3gubm90aWZ5QkxFQ2hhcmFjdGVyaXN0aWNWYWx1ZUNoYW5nZSh7XG4gICAgICAgICAgICAgIGRldmljZUlkLFxuICAgICAgICAgICAgICBzZXJ2aWNlSWQsXG4gICAgICAgICAgICAgIGNoYXJhY3RlcmlzdGljSWQ6IGl0ZW0udXVpZCxcbiAgICAgICAgICAgICAgc3RhdGU6IHRydWUsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGZhaWwocmVzKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ2dldEJMRURldmljZUNoYXJhY3RlcmlzdGljcycsIHJlcylcbiAgICAgIH1cbiAgICB9KVxuICAgIC8vIOaTjeS9nOS5i+WJjeWFiOebkeWQrO+8jOS/neivgeesrOS4gOaXtumXtOiOt+WPluaVsOaNrlxuICAgIHd4Lm9uQkxFQ2hhcmFjdGVyaXN0aWNWYWx1ZUNoYW5nZSgoY2hhcmFjdGVyaXN0aWMpID0+IHtcbiAgICAgIGNvbnN0IGlkeCA9IGluQXJyYXkodGhpcy5kYXRhLmNocywgJ3V1aWQnLCBjaGFyYWN0ZXJpc3RpYy5jaGFyYWN0ZXJpc3RpY0lkKVxuICAgICAgY29uc3QgZGF0YSA9IHt9XG4gICAgICBpZiAoaWR4ID09PSAtMSkge1xuICAgICAgICBkYXRhW2BjaHNbJHt0aGlzLmRhdGEuY2hzLmxlbmd0aH1dYF0gPSB7XG4gICAgICAgICAgdXVpZDogY2hhcmFjdGVyaXN0aWMuY2hhcmFjdGVyaXN0aWNJZCxcbiAgICAgICAgICB2YWx1ZTogYWIyaGV4KGNoYXJhY3RlcmlzdGljLnZhbHVlKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkYXRhW2BjaHNbJHtpZHh9XWBdID0ge1xuICAgICAgICAgIHV1aWQ6IGNoYXJhY3RlcmlzdGljLmNoYXJhY3RlcmlzdGljSWQsXG4gICAgICAgICAgdmFsdWU6IGFiMmhleChjaGFyYWN0ZXJpc3RpYy52YWx1ZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gZGF0YVtgY2hzWyR7dGhpcy5kYXRhLmNocy5sZW5ndGh9XWBdID0ge1xuICAgICAgLy8gICB1dWlkOiBjaGFyYWN0ZXJpc3RpYy5jaGFyYWN0ZXJpc3RpY0lkLFxuICAgICAgLy8gICB2YWx1ZTogYWIyaGV4KGNoYXJhY3RlcmlzdGljLnZhbHVlKVxuICAgICAgLy8gfVxuICAgICAgdGhpcy5zZXREYXRhKGRhdGEpXG4gICAgfSlcbiAgfSxcbiAgd3JpdGVCTEVDaGFyYWN0ZXJpc3RpY1ZhbHVlKCkge1xuICAgIC8vIOWQkeiTneeJmeiuvuWkh+WPkemAgeS4gOS4qjB4MDDnmoQxNui/m+WItuaVsOaNrlxuICAgIGxldCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoMSlcbiAgICBsZXQgZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKVxuICAgIGRhdGFWaWV3LnNldFVpbnQ4KDAsIE1hdGgucmFuZG9tKCkgKiAyNTUgfCAwKVxuICAgIHd4LndyaXRlQkxFQ2hhcmFjdGVyaXN0aWNWYWx1ZSh7XG4gICAgICBkZXZpY2VJZDogdGhpcy5fZGV2aWNlSWQsXG4gICAgICBzZXJ2aWNlSWQ6IHRoaXMuX2RldmljZUlkLFxuICAgICAgY2hhcmFjdGVyaXN0aWNJZDogdGhpcy5fY2hhcmFjdGVyaXN0aWNJZCxcbiAgICAgIHZhbHVlOiBidWZmZXIsXG4gICAgfSlcbiAgfSxcbiAgY2xvc2VCbHVldG9vdGhBZGFwdGVyKCkge1xuICAgIHd4LmNsb3NlQmx1ZXRvb3RoQWRhcHRlcigpXG4gICAgdGhpcy5fZGlzY292ZXJ5U3RhcnRlZCA9IGZhbHNlXG4gIH0sXG59KVxuIl19