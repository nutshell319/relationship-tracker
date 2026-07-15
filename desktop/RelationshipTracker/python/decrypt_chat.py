"""
WeChat 聊天记录解密导出脚本
============================
封装 pywxdump 库，通过 CLI 方式供 C# 桌面端调用。
C# 端通过 Process.StandardOutput 读取本脚本 stdout 输出的 JSON 结果。

用法：
    python decrypt_chat.py --mode list              # 列出所有会话
    python decrypt_chat.py --mode export --wxid xxx # 导出指定会话的消息

错误处理约定：
    所有错误均输出 {"error": true, "type": "<错误类型>", "message": "<人类可读描述>"} 到 stdout。
    C# 端根据 type 字段做分支处理。

依赖：
    pywxdump >= 3.0.0（pip install -r requirements.txt）

注意：
    pywxdump 的 API 在不同版本间可能有差异。本脚本按文档预期的函数名调用，
    若实际导入的函数名不同，请根据 import 时的错误提示调整。
"""

import argparse
import json
import sys
import os


# ============================================================================
# 辅助函数
# ============================================================================

def output_json(data: dict) -> None:
    """将字典序列化为 JSON 输出到 stdout，供 C# 读取。"""
    # ensure_ascii=False 保证中文不乱码
    json.dump(data, sys.stdout, ensure_ascii=False, default=str)
    sys.stdout.write("\n")
    sys.stdout.flush()


def error_exit(error_type: str, message: str, extra: dict = None) -> None:
    """输出统一格式的 JSON 错误并退出。

    Args:
        error_type: 错误类型标识（python_env / not_running / not_installed / decrypt_failed）
        message:   人类可读的错误描述
        extra:     附加到错误 JSON 中的额外字段（可选）
    """
    payload = {"error": True, "type": error_type, "message": message}
    if extra:
        payload.update(extra)
    output_json(payload)
    sys.exit(0)  # 退出码 0，C# 端通过 JSON 中的 error 字段判断成败


# ============================================================================
# pywxdump 导入检测
# ============================================================================

def import_pywxdump():
    """尝试导入 pywxdump 核心模块，失败则输出 python_env 错误并退出。

    注意：
        pywxdump 的不同版本中模块路径和导出函数名可能有变化。
        以下导入路径按文档预期编写，若实际版本不同，请根据报错调整：
          - 旧版可能是 from pywxdump import ...
          - 新版可能是 from pywxdump.core import ...
          - 函数名也可能有 get_wechat_info / get_wechat / get_info 等变体
    """
    try:
        # 尝试标准导入路径（pywxdump >= 3.0）
        import pywxdump
        return pywxdump
    except ImportError:
        pass

    # 如果 pywxdump 未安装，提示用户安装
    error_exit(
        error_type="python_env",
        message="pywxdump 未安装，请运行: pip install -r requirements.txt"
    )


# ============================================================================
# 核心功能
# ============================================================================

def get_wechat_info_safe(wx_dump):
    """安全获取微信进程信息和解密密钥。

    pywxdump 中获取微信信息的函数名可能为以下之一（按版本不同）：
        - wx_dump.get_wechat_info()   （文档预期）
        - wx_dump.get_wechat()        （旧版）
        - wx_dump.core.get_wechat_info()

    返回:
        dict: 包含微信进程信息、解密密钥、数据路径等字段
    """
    # 尝试多种可能的函数名
    candidates = [
        lambda: wx_dump.get_wechat_info(),
    ]

    # 如果 wx_dump 有 core 子模块，也尝试
    if hasattr(wx_dump, "core"):
        candidates.append(lambda: wx_dump.core.get_wechat_info())

    last_error = None
    for candidate in candidates:
        try:
            result = candidate()
            if result:
                return result
        except Exception as e:
            last_error = e
            continue

    error_exit(
        error_type="not_running",
        message=f"无法获取微信进程信息，请确保微信已启动并登录。详情: {last_error}"
    )


def list_sessions(wx_dump) -> None:
    """列出所有聊天会话并输出 JSON。"""
    # 1. 获取微信信息和解密密钥
    wx_info = get_wechat_info_safe(wx_dump)

    # 2. 解密数据库
    # 注意：函数名可能为 decrypt_databases / decrypt_db 等
    try:
        if hasattr(wx_dump, "decrypt_databases"):
            db_paths = wx_dump.decrypt_databases(wx_info)
        elif hasattr(wx_dump, "core") and hasattr(wx_dump.core, "decrypt_databases"):
            db_paths = wx_dump.core.decrypt_databases(wx_info)
        else:
            db_paths = wx_dump.decrypt_database(wx_info)
    except Exception as e:
        error_exit(
            error_type="decrypt_failed",
            message=f"数据库解密失败: {e}"
        )

    if not db_paths:
        error_exit(
            error_type="decrypt_failed",
            message="数据库解密后未获得有效路径，请检查微信数据目录权限"
        )

    # 3. 获取所有会话列表
    # 注意：函数名可能为 get_all_sessions / get_sessions / list_sessions 等
    try:
        if hasattr(wx_dump, "get_all_sessions"):
            sessions = wx_dump.get_all_sessions(db_paths)
        elif hasattr(wx_dump, "core") and hasattr(wx_dump.core, "get_all_sessions"):
            sessions = wx_dump.core.get_all_sessions(db_paths)
        else:
            sessions = wx_dump.get_sessions(db_paths)
    except Exception as e:
        error_exit(
            error_type="decrypt_failed",
            message=f"读取会话列表失败: {e}"
        )

    # 4. 标准化输出格式
    # 会话对象字段按 WeChatMsg 兼容格式命名：
    #   wxId, nickname, messageCount, dateStart, dateEnd, avatarPath
    normalized = []
    if sessions:
        for s in sessions:
            item = {
                "wxId": getattr(s, "wxid", getattr(s, "wxId", "")),
                "nickname": getattr(s, "nickname", getattr(s, "nickName", "")),
                "messageCount": getattr(s, "message_count", getattr(s, "messageCount", 0)),
                "dateStart": getattr(s, "date_start", getattr(s, "dateStart", "")),
                "dateEnd": getattr(s, "date_end", getattr(s, "dateEnd", "")),
                "avatarPath": getattr(s, "avatar_path", getattr(s, "avatarPath", "")),
            }
            normalized.append(item)

    output_json({"sessions": normalized})


def export_messages(wx_dump, wxid: str) -> None:
    """导出指定会话的聊天记录并输出 JSON。

    Args:
        wxid: 要导出的会话 wxId（来自 list 返回的 session.wxId）
    """
    # 1. 获取微信信息和解密密钥
    wx_info = get_wechat_info_safe(wx_dump)

    # 2. 解密数据库
    try:
        if hasattr(wx_dump, "decrypt_databases"):
            db_paths = wx_dump.decrypt_databases(wx_info)
        elif hasattr(wx_dump, "core") and hasattr(wx_dump.core, "decrypt_databases"):
            db_paths = wx_dump.core.decrypt_databases(wx_info)
        else:
            db_paths = wx_dump.decrypt_database(wx_info)
    except Exception as e:
        error_exit(
            error_type="decrypt_failed",
            message=f"数据库解密失败: {e}"
        )

    if not db_paths:
        error_exit(
            error_type="decrypt_failed",
            message="数据库解密后未获得有效路径"
        )

    # 3. 导出指定会话的消息
    # 注意：函数名可能为 get_chat_messages / get_messages / export_messages 等
    try:
        if hasattr(wx_dump, "get_chat_messages"):
            messages = wx_dump.get_chat_messages(db_paths, wxid)
        elif hasattr(wx_dump, "core") and hasattr(wx_dump.core, "get_chat_messages"):
            messages = wx_dump.core.get_chat_messages(db_paths, wxid)
        else:
            messages = wx_dump.get_messages(db_paths, wxid)
    except Exception as e:
        error_exit(
            error_type="decrypt_failed",
            message=f"导出消息失败: {e}"
        )

    # 4. 标准化输出格式
    # 消息字段按 WeChatMsg 兼容格式命名：
    #   CreateTime, IsSender, StrContent, StrTalker, Type
    normalized = []
    if messages:
        for m in messages:
            item = {
                "CreateTime": getattr(m, "CreateTime", getattr(m, "create_time", getattr(m, "timestamp", ""))),
                "IsSender": getattr(m, "IsSender", getattr(m, "is_sender", 0)),
                "StrContent": getattr(m, "StrContent", getattr(m, "str_content", getattr(m, "content", ""))),
                "StrTalker": getattr(m, "StrTalker", getattr(m, "str_talker", getattr(m, "talker", ""))),
                "Type": getattr(m, "Type", getattr(m, "type", getattr(m, "msg_type", 0))),
            }
            normalized.append(item)

    output_json({"messages": normalized})


# ============================================================================
# CLI 入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="WeChat 聊天记录解密导出工具（基于 pywxdump）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python decrypt_chat.py --mode list                # 列出所有会话
  python decrypt_chat.py --mode export --wxid wxid_xxx  # 导出指定会话
        """
    )
    parser.add_argument(
        "--mode",
        required=True,
        choices=["list", "export"],
        help="运行模式: list（列出会话）/ export（导出消息）"
    )
    parser.add_argument(
        "--wxid",
        required=False,
        default=None,
        help="要导出的会话 wxId（仅 export 模式需要）"
    )

    args = parser.parse_args()

    # 参数校验：export 模式必须提供 --wxid
    if args.mode == "export" and not args.wxid:
        error_exit(
            error_type="python_env",
            message="export 模式必须提供 --wxid 参数，请先从 list 模式获取目标会话的 wxId"
        )

    # 导入 pywxdump（失败会自动输出 python_env 错误并退出）
    wx_dump = import_pywxdump()

    # 分发到对应模式
    if args.mode == "list":
        list_sessions(wx_dump)
    elif args.mode == "export":
        export_messages(wx_dump, args.wxid)


if __name__ == "__main__":
    main()
