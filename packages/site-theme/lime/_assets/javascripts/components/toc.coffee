# 获取标题编号
getHeadingNo = ( $h, tagName ) ->
  return $(tagName, $(".Article-content")).index($h) + 1

# 添加目录条目
addTocItem = ( $h ) ->
  id = $h.attr("id")
  tagName = $h.get(0).tagName.toLowerCase()

  if not id
    idx = getHeadingNo($h, tagName)
    id = "#{if tagName is "h2" then "h" else "subH"}eading-#{idx}"

    $h.attr "id", id

  return "<li><a href=\"##{id}\">#{$h.text()}</a></li>"

# 生成目录列表
generateToc = ->
  $toc = $("<ul class=\"nav\" />")
  $item = null

  $("h2:not([data-toc-skip]), h3:not([data-toc-skip])", $(".Article-content")).each ->
    $h = $(@)

    if @tagName.toLowerCase() is "h2"
      $item = $(addTocItem $h)

      $item.append("<ul class=\"nav\" />") if $("ul", $item).size() is 0
      $item.appendTo $toc
    else
      $("ul", $item).append addTocItem($h)

  return $toc

bindEvent = ( $widget ) ->
  cls = ".Widget--toc"
  $cnt = $(".Article-content")

  $widget
    .on
      "affixed-top.bs.affix": ->
        $(@).css "position", "static"
      "affixed.bs.affix": ->
        $(@).css "position", "fixed"
    .affix
      offset:
        top: $(cls).offset().top
        bottom: ->
          return $(document).height() - ($cnt.offset().top + $cnt.outerHeight(true))

  $("body").scrollspy target: cls

# 初始化目录
initToc = ( $toc ) ->
  cls = ".Widget--toc"

  bindEvent $(cls).find(".Widget-body").append($toc).closest(cls)

$(document).ready ->
  $container = $(".Widget--toc")

  if $container.size() is 1
    $toc = $(".Widget-body > .nav", $container)
    isExist = $toc.size() isnt 0

    if not isExist
      $toc = generateToc()

    if $("li", $toc).size() > 0
      if isExist
        bindEvent $container
      else
        initToc $toc
    else
      $container.remove()
