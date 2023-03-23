$(document).on "click", ".Nav-cell a", ->
  $el = $(@)
  cls = "is-active"

  $(".Navs .#{cls}, .Grids .#{cls}").removeClass cls

  $(".Grids [data-flag='#{$el.attr "data-flag"}']")
    .add $el
    .addClass cls

  return false

$(document).ready ->
  $(".Navs [data-flag]:first").click()

  $(".Repo, .Site").each ->
    $(@).attr("target", "_blank") if @hostname isnt location.hostname

  $cnt = $('.Moments')

  $('.js-affix').each ->
    $(@)
      .on
        "affixed-top.bs.affix": ->
          $(@).css
            position: 'static'
            width: 'auto'
        "affixed.bs.affix": ->
          $(@).css
            position: "fixed"
            width: $(@).parent().width()
      .affix
        offset:
          top: $(@).offset().top
          bottom: ->
            return $(document).height() - ($cnt.offset().top + $cnt.outerHeight(true))

