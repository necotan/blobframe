import { ChevronDown, createElement } from 'lucide'

/**
 * フォルダの開閉マーク(Tweakpane が CSS の縦線2本で描く `.tp-fldv_m`)の中身を Lucide の chevron にする。
 * フォルダをすべて追加した後に呼ぶこと。回転と配置は pane.css で行う。
 */
export function replaceFolderMarks(root: HTMLElement) {
  for (const mark of root.querySelectorAll('.tp-fldv_m')) {
    mark.replaceChildren(createElement(ChevronDown, { 'aria-hidden': 'true' }))
  }
}
