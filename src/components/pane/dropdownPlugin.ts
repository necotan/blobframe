import {
  ListConstraint,
  bindValueMap,
  createListConstraint,
  createPlugin,
  parseListOptions,
  parseRecord,
  stringFromUnknown,
  writePrimitive,
  type InputBindingPlugin,
  type ListItem,
  type ListParamsOptions,
  type Value,
  type ValueController,
  ValueMap,
  type View,
  type ViewProps,
} from '@tweakpane/core'
import { Check, ChevronDown, createElement } from 'lucide'

type Params = { options: ListParamsOptions<string> }
type Props = ValueMap<{ options: ListItem<string>[] }>

let nextId = 0

// Tweakpane 標準の <select> は開いた一覧を OS が描き、見た目を揃えられないため自前の一覧に置き換える
/**
 * 登録したプラグインは標準より先に判定されるので、`options` 付きの文字列バインディングはすべてこれになる。
 */
export const DropdownPlugin: InputBindingPlugin<string, string, Params> = createPlugin({
  id: 'input-blobframe-dropdown',
  type: 'input',
  accept(value, params) {
    if (typeof value !== 'string') return null
    const result = parseRecord<Params>(params, (p) => ({ options: p.required.custom(parseListOptions<string>) }))
    return result ? { initialValue: value, params: result } : null
  },
  binding: {
    reader: () => stringFromUnknown,
    constraint: (args) => createListConstraint(args.params.options) ?? new ListConstraint<string>([]),
    writer: () => writePrimitive,
  },
  controller(args) {
    const constraint = args.constraint as ListConstraint<string>
    return new DropdownController(args.document, {
      props: new ValueMap({ options: constraint.values.value('options') }),
      value: args.value,
      viewProps: args.viewProps,
    })
  },
})

class DropdownController implements ValueController<string, DropdownView> {
  readonly value: Value<string>
  readonly view: DropdownView
  readonly viewProps: ViewProps

  constructor(doc: Document, config: { props: Props; value: Value<string>; viewProps: ViewProps }) {
    this.value = config.value
    this.viewProps = config.viewProps
    this.view = new DropdownView(doc, config)
  }
}

class DropdownView implements View {
  readonly element: HTMLElement
  private readonly doc: Document
  private readonly button: HTMLButtonElement
  private readonly label: HTMLSpanElement
  private readonly props: Props
  private readonly value: Value<string>
  private readonly listId = `bf-dd-list-${++nextId}`
  private list: HTMLUListElement | null = null
  private activeIndex = -1

  constructor(doc: Document, config: { props: Props; value: Value<string>; viewProps: ViewProps }) {
    this.doc = doc
    this.props = config.props
    this.value = config.value

    this.element = doc.createElement('div')
    this.element.classList.add('bf-dd')
    config.viewProps.bindClassModifiers(this.element)

    this.button = doc.createElement('button')
    this.button.type = 'button'
    this.button.classList.add('bf-dd_b')
    this.button.setAttribute('aria-haspopup', 'listbox')
    this.button.setAttribute('aria-expanded', 'false')
    config.viewProps.bindDisabled(this.button)
    this.label = doc.createElement('span')
    this.label.classList.add('bf-dd_t')
    this.button.append(this.label, createElement(ChevronDown, { class: 'bf-dd_m', 'aria-hidden': 'true' }))
    this.element.appendChild(this.button)

    this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this)
    this.onScroll = this.onScroll.bind(this)
    this.close = this.close.bind(this)
    this.button.addEventListener('click', () => (this.list ? this.close() : this.open()))
    this.button.addEventListener('keydown', (e) => this.onKeyDown(e))
    this.button.addEventListener('blur', this.close)

    this.value.emitter.on('change', () => this.update())
    bindValueMap(this.props, 'options', () => {
      this.update()
      if (this.list) this.renderList()
    })
    config.viewProps.handleDispose(this.close)
  }

  private get options(): ListItem<string>[] {
    return this.props.get('options')
  }

  private update() {
    const item = this.options.find((o) => o.value === this.value.rawValue)
    this.label.textContent = item?.text ?? this.value.rawValue
  }

  private open() {
    if (this.list || this.button.disabled) return
    const list = this.doc.createElement('ul')
    list.id = this.listId
    list.classList.add('bf-dd_l')
    list.setAttribute('role', 'listbox')
    // フォーカスはボタンに残したまま一覧を操作するので、一覧のクリックでボタンの blur を起こさない
    list.addEventListener('pointerdown', (e) => e.preventDefault())
    // CSS 変数を引き継ぐためパネルのルート内に置く。fixed なのでサイドバーのスクロール領域で切れない
    ;(this.element.closest('.tp-rotv') ?? this.doc.body).appendChild(list)
    this.list = list
    this.activeIndex = Math.max(0, this.options.findIndex((o) => o.value === this.value.rawValue))
    this.renderList()
    this.position()

    this.button.setAttribute('aria-expanded', 'true')
    this.button.setAttribute('aria-controls', this.listId)
    this.doc.addEventListener('pointerdown', this.onDocumentPointerDown, true)
    // 開いたまま周りがスクロールやリサイズで動くと一覧だけ取り残されるので閉じる
    this.doc.defaultView?.addEventListener('resize', this.close)
    this.doc.addEventListener('scroll', this.onScroll, true)
  }

  private close() {
    if (!this.list) return
    this.list.remove()
    this.list = null
    this.button.setAttribute('aria-expanded', 'false')
    this.button.removeAttribute('aria-controls')
    this.button.removeAttribute('aria-activedescendant')
    this.doc.removeEventListener('pointerdown', this.onDocumentPointerDown, true)
    this.doc.defaultView?.removeEventListener('resize', this.close)
    this.doc.removeEventListener('scroll', this.onScroll, true)
  }

  private renderList() {
    const list = this.list!
    list.replaceChildren(
      ...this.options.map((item, i) => {
        const li = this.doc.createElement('li')
        li.id = `${this.listId}-${i}`
        li.classList.add('bf-dd_o')
        li.setAttribute('role', 'option')
        const selected = item.value === this.value.rawValue
        li.setAttribute('aria-selected', String(selected))
        if (i === this.activeIndex) li.classList.add('bf-dd_o-active')
        const text = this.doc.createElement('span')
        text.textContent = item.text
        li.append(text)
        if (selected) li.append(createElement(Check, { class: 'bf-dd_c', 'aria-hidden': 'true' }))
        li.addEventListener('pointerenter', () => this.setActive(i))
        li.addEventListener('click', () => this.select(i))
        return li
      }),
    )
    this.setActive(this.activeIndex)
  }

  private position() {
    const list = this.list!
    const rect = this.button.getBoundingClientRect()
    const viewportHeight = this.doc.documentElement.clientHeight
    list.style.left = `${rect.left}px`
    list.style.minWidth = `${rect.width}px`
    const below = viewportHeight - rect.bottom
    // 下に入りきらず、上の方が広いときだけ上に開く
    if (below < list.offsetHeight + 8 && rect.top > below) {
      list.style.top = ''
      list.style.bottom = `${viewportHeight - rect.top + 2}px`
      list.style.maxHeight = `${rect.top - 8}px`
    } else {
      list.style.bottom = ''
      list.style.top = `${rect.bottom + 2}px`
      list.style.maxHeight = `${below - 8}px`
    }
  }

  private setActive(index: number) {
    if (!this.list || index < 0 || index >= this.options.length) return
    this.list.children[this.activeIndex]?.classList.remove('bf-dd_o-active')
    this.activeIndex = index
    const li = this.list.children[index] as HTMLElement | undefined
    if (li) {
      li.classList.add('bf-dd_o-active')
      // scrollIntoView は一覧の外側(サイドバー)までスクロールさせることがあるので、一覧の中だけ動かす
      const list = this.list
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight
    }
    this.button.setAttribute('aria-activedescendant', `${this.listId}-${index}`)
  }

  private select(index: number) {
    const item = this.options[index]
    if (item) this.value.rawValue = item.value
    this.close()
  }

  private onKeyDown(e: KeyboardEvent) {
    const last = this.options.length - 1
    if (!this.list) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        this.open()
      }
      return
    }
    const actions: Record<string, () => void> = {
      ArrowDown: () => this.setActive(Math.min(last, this.activeIndex + 1)),
      ArrowUp: () => this.setActive(Math.max(0, this.activeIndex - 1)),
      Home: () => this.setActive(0),
      End: () => this.setActive(last),
      Enter: () => this.select(this.activeIndex),
      ' ': () => this.select(this.activeIndex),
      Escape: () => this.close(),
    }
    const action = actions[e.key]
    if (action) {
      e.preventDefault()
      action()
    } else if (e.key === 'Tab') {
      this.close()
    }
  }

  private onScroll(e: Event) {
    if (e.target !== this.list) this.close()
  }

  private onDocumentPointerDown(e: PointerEvent) {
    const target = e.target as Node
    if (!this.element.contains(target) && !this.list?.contains(target)) this.close()
  }
}
