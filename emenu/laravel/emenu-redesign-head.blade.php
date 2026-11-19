{{-- Подключить в конце <head> шаблона электронного меню, после его CSS.
     На <html> добавить: data-emenu-redesign="fasol" data-fasol-assets="/fasol/" data-fasol-home="АДРЕС_НОВОЙ_ГЛАВНОЙ" --}}
<link rel="stylesheet" href="{{ asset('fasol/fonts/fonts.css') }}">
<link rel="stylesheet" href="{{ asset('fasol/assets/emenu-redesign.css') }}?v=4bcae7ffb2">
<script defer src="{{ asset('fasol/assets/emenu-redesign.js') }}?v=4bcae7ffb2"></script>
