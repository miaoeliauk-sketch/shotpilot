# dmgbuild 配置：安装窗口里左边是软件、右边是「应用程序」文件夹，背景上有箭头和中文提示。
# 直接写 .DS_Store，不用 AppleScript 去摆 Finder 窗口，在 CI 上更稳。
import os.path

app = defines['app']  # noqa: F821  dmgbuild 注入
appname = os.path.basename(app)

format = 'UDZO'
filesystem = 'HFS+'
files = [app]
symlinks = {'Applications': '/Applications'}
background = defines['background']  # noqa: F821

window_rect = ((200, 120), (640, 400))
icon_locations = {appname: (160, 200), 'Applications': (480, 200)}
default_view = 'icon-view'
icon_size = 112
text_size = 13
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
